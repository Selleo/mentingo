import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { outboxEvents } from "src/storage/schema";

import { OUTBOX_STATUSES } from "./outbox.types";

import type { OutboxEnvelope, OutboxStatus } from "./outbox.types";

@Injectable()
export class OutboxRepository {
  private static readonly MAX_ERROR_LENGTH = 4000;

  private readonly logger = new Logger(OutboxRepository.name);

  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async claimNext(): Promise<OutboxEnvelope | null> {
    const [claimResult] = await this.db.execute(sql`
      WITH candidates AS (
        SELECT id
        FROM outbox_events
        WHERE status IN (${OUTBOX_STATUSES.PENDING}, ${OUTBOX_STATUSES.FAILED})
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events o
      SET
        status = ${OUTBOX_STATUSES.PROCESSING},
        updated_at = NOW()
      FROM candidates c
      WHERE o.id = c.id
      RETURNING
        o.id AS "id",
        o.event_type AS "eventType",
        o.payload AS "payload",
        o.status AS "status",
        o.attempt_count AS "attemptCount",
        o.published_at AS "publishedAt",
        o.last_error AS "lastError",
        o.created_at AS "createdAt",
        o.tenant_id AS "tenantId"
    `);

    if (!claimResult) return null;

    return this.normalizeRow(claimResult);
  }

  async markPublished(id: string): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUSES.PUBLISHED,
        publishedAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(outboxEvents.id, id));
  }

  async markFailed(id: string, error: string, attemptCount: number): Promise<void> {
    const safeAttemptCount = Number.isFinite(attemptCount) ? attemptCount : 1;
    const safeError = this.toErrorMessage(error).slice(0, OutboxRepository.MAX_ERROR_LENGTH);

    await this.db
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUSES.FAILED,
        attemptCount: safeAttemptCount,
        lastError: safeError,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(outboxEvents.id, id));
  }

  private normalizeRow(row: Record<string, unknown>): OutboxEnvelope {
    const id = this.getString(row, "id");
    const tenantId = this.getString(row, "tenantId");
    const payload = this.parsePayload(row.payload, id, tenantId);
    const status = this.getStatus(row);

    return {
      id,
      eventType: this.getString(row, "eventType"),
      payload: payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {},
      status,
      attemptCount: this.getNumber(row, "attemptCount", 0),
      publishedAt: this.getNullableString(row, "publishedAt"),
      lastError: this.getNullableString(row, "lastError"),
      createdAt: this.getString(row, "createdAt"),
      tenantId,
    };
  }

  private parsePayload(
    value: unknown,
    eventId: string,
    tenantId: string,
  ): Record<string, unknown> | null {
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    if (typeof value !== "string") return null;

    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      this.logger.warn(
        `[tenant=${tenantId}] Failed to parse outbox payload JSON string for event ${eventId}`,
      );
      return null;
    }
  }

  private getStatus(row: Record<string, unknown>): OutboxEnvelope["status"] {
    const rawStatus = this.getString(row, "status", OUTBOX_STATUSES.PENDING);
    return Object.values(OUTBOX_STATUSES).includes(rawStatus as OutboxStatus)
      ? (rawStatus as OutboxEnvelope["status"])
      : OUTBOX_STATUSES.PENDING;
  }

  private getString(row: Record<string, unknown>, key: string, fallback = ""): string {
    const value = row[key];
    return typeof value === "string" ? value : fallback;
  }

  private getNullableString(row: Record<string, unknown>, key: string): string | null {
    const value = row[key];
    return typeof value === "string" ? value : null;
  }

  private getNumber(row: Record<string, unknown>, key: string, fallback: number): number {
    const value = row[key];
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }

  private toErrorMessage(error: unknown): string {
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
