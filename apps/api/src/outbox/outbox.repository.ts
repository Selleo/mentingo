import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { outboxEvents } from "src/storage/schema";

import { OUTBOX_STATUSES } from "./outbox.types";

import type { OutboxEnvelope } from "./outbox.types";

@Injectable()
export class OutboxRepository {
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
      RETURNING o.*
    `);

    if (!claimResult) return null;

    return this.normalizeRow(claimResult);
  }

  async markPublished(id: string): Promise<void> {
    if (!id) {
      this.logger.error("Skipping markPublished because outbox id is empty");
      return;
    }

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
    if (!id) {
      this.logger.error("Skipping markFailed because outbox id is empty");
      return;
    }

    const safeAttemptCount = Number.isFinite(attemptCount) ? attemptCount : 1;

    await this.db
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUSES.FAILED,
        attemptCount: safeAttemptCount,
        lastError: error.slice(0, 4000),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(outboxEvents.id, id));
  }

  private normalizeRow(row: Record<string, unknown>): OutboxEnvelope {
    const getString = (camel: string, snake: string, fallback = ""): string => {
      const value = row[camel] ?? row[snake];
      return typeof value === "string" ? value : fallback;
    };

    const getNullableString = (camel: string, snake: string): string | null => {
      const value = row[camel] ?? row[snake];
      return typeof value === "string" ? value : null;
    };

    const getNumber = (camel: string, snake: string, fallback: number): number => {
      const value = row[camel] ?? row[snake];
      if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      }
      return fallback;
    };

    const id = getString("id", "id");
    const tenantId = getString("tenantId", "tenant_id");
    const payload = this.parsePayload(row.payload, id, tenantId);
    const rawStatus = getString("status", "status", OUTBOX_STATUSES.PENDING);
    const status: OutboxEnvelope["status"] = Object.values(OUTBOX_STATUSES).includes(
      rawStatus as any,
    )
      ? (rawStatus as OutboxEnvelope["status"])
      : OUTBOX_STATUSES.PENDING;

    return {
      id,
      eventType: getString("eventType", "event_type"),
      payload: payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {},
      status,
      attemptCount: getNumber("attemptCount", "attempt_count", 0),
      publishedAt: getNullableString("publishedAt", "published_at"),
      lastError: getNullableString("lastError", "last_error"),
      createdAt: getString("createdAt", "created_at"),
      tenantId,
    };
  }

  private parsePayload(
    value: unknown,
    eventId: string,
    tenantId: string,
  ): Record<string, unknown> | null {
    let current: unknown = value;

    for (let i = 0; i < 2; i += 1) {
      if (current && typeof current === "object") {
        return current as Record<string, unknown>;
      }

      if (typeof current === "string") {
        try {
          current = JSON.parse(current) as unknown;
          continue;
        } catch {
          const tenantScope = tenantId ? `tenant=${tenantId}` : "tenant=unknown";
          this.logger.warn(
            `[${tenantScope}] Failed to parse outbox payload JSON string for event ${eventId}`,
          );
          return null;
        }
      }

      return null;
    }

    return null;
  }
}
