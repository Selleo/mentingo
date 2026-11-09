import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { outboxEvents } from "src/storage/schema";

import {
  OUTBOX_NOTIFY_CHANNEL,
  OUTBOX_RETRY_DELAY_SECONDS,
  OUTBOX_STALLED_CLAIM_SECONDS,
} from "./outbox.constants";
import { OUTBOX_STATUSES } from "./outbox.types";

import type {
  OutboxClaim,
  OutboxEnvelope,
  OutboxFailedAttempt,
  OutboxPublication,
} from "./outbox.types";
import type { UUIDType } from "src/common";

@Injectable()
export class OutboxRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async createPending(
    publication: OutboxPublication,
    transaction: DatabasePg = this.db,
    id?: string,
  ): Promise<void> {
    await transaction.insert(outboxEvents).values({
      ...publication,
      ...(id && { id }),
      status: OUTBOX_STATUSES.PENDING,
      attemptCount: 0,
    });
  }

  /** Wakes the listening dispatchers. Drizzle has no builder for NOTIFY, so this stays raw. */
  async notifyPending(transaction: DatabasePg = this.db): Promise<void> {
    await transaction.execute(sql`SELECT pg_notify(${OUTBOX_NOTIFY_CHANNEL}, '')`);
  }

  /**
   * Claims the tenant's oldest due event: pending events at once, failed ones after the retry
   * delay. Rows another dispatcher is claiming are skipped, so no event is claimed twice. The
   * tenant is filtered explicitly, so claiming does not depend on row-level security alone.
   */
  async claimNextDueEvent(tenantId: UUIDType): Promise<OutboxEnvelope | null> {
    const nextDueEventId = this.db
      .select({ id: outboxEvents.id })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.tenantId, tenantId),
          or(
            eq(outboxEvents.status, OUTBOX_STATUSES.PENDING),
            and(
              eq(outboxEvents.status, OUTBOX_STATUSES.FAILED),
              lt(outboxEvents.updatedAt, this.secondsAgo(OUTBOX_RETRY_DELAY_SECONDS)),
            ),
          ),
        ),
      )
      .orderBy(asc(outboxEvents.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    const [claimedEvent] = await this.db
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUSES.PROCESSING,
        claimId: sql`gen_random_uuid()`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(outboxEvents.id, sql`(${nextDueEventId})`))
      .returning({
        id: outboxEvents.id,
        eventType: outboxEvents.eventType,
        payload: outboxEvents.payload,
        attemptCount: outboxEvents.attemptCount,
        succeededHandlers: outboxEvents.succeededHandlers,
        tenantId: outboxEvents.tenantId,
        claimId: outboxEvents.claimId,
      });

    return claimedEvent ?? null;
  }

  /** Returns claims left behind by a dispatcher that stopped mid-delivery, so they are retried. */
  async releaseStalledClaims(tenantId: UUIDType): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({ status: OUTBOX_STATUSES.PENDING, updatedAt: sql`NOW()` })
      .where(
        and(
          eq(outboxEvents.tenantId, tenantId),
          eq(outboxEvents.status, OUTBOX_STATUSES.PROCESSING),
          lt(outboxEvents.updatedAt, this.secondsAgo(OUTBOX_STALLED_CLAIM_SECONDS)),
        ),
      );
  }

  /**
   * Locks the event for the current transaction while the claim is still ours, and returns the
   * handlers that already succeeded. Null means another dispatcher took the event over.
   */
  async lockClaimedEvent(
    claim: OutboxClaim,
  ): Promise<Pick<OutboxEnvelope, "succeededHandlers"> | null> {
    const [claimedEvent] = await this.db
      .select({ succeededHandlers: outboxEvents.succeededHandlers })
      .from(outboxEvents)
      .where(and(this.isOwnClaim(claim), eq(outboxEvents.status, OUTBOX_STATUSES.PROCESSING)))
      .for("update");

    return claimedEvent ?? null;
  }

  /** Remembers that one handler succeeded, so retries skip it. */
  async recordSucceededHandler(claim: OutboxClaim, handlerName: string): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        succeededHandlers: sql`${outboxEvents.succeededHandlers} || jsonb_build_array(${handlerName}::text)`,
        updatedAt: sql`NOW()`,
      })
      .where(this.isOwnClaim(claim));
  }

  async replaceStoredPayload(claim: OutboxClaim, payload: Record<string, unknown>): Promise<void> {
    await this.db.update(outboxEvents).set({ payload }).where(this.isOwnClaim(claim));
  }

  async markPublished(claim: OutboxClaim): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({ status: OUTBOX_STATUSES.PUBLISHED, publishedAt: sql`NOW()`, updatedAt: sql`NOW()` })
      .where(this.isOwnClaim(claim));
  }

  /** The handlers have consumed the payload by now, so it is cleared instead of kept. */
  async markPublishedWithoutPayload(claim: OutboxClaim): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUSES.PUBLISHED,
        payload: {},
        publishedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(this.isOwnClaim(claim));
  }

  async recordFailedAttempt(
    claim: OutboxClaim,
    { status, attemptCount, lastError }: OutboxFailedAttempt,
  ): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({ status, attemptCount, lastError, updatedAt: sql`NOW()` })
      .where(this.isOwnClaim(claim));
  }

  private isOwnClaim({ id, claimId }: OutboxClaim) {
    return and(
      eq(outboxEvents.id, id),
      claimId ? eq(outboxEvents.claimId, claimId) : isNull(outboxEvents.claimId),
    );
  }

  private secondsAgo(seconds: number) {
    return sql`NOW() - make_interval(secs => ${seconds})`;
  }
}
