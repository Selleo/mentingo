import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { outboxEvents } from "src/storage/schema";

import {
  OUTBOX_ABANDONED_CLAIM_ERROR,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_NOTIFY_CHANNEL,
  OUTBOX_RETRY_DELAYS_SECONDS,
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
   * Claims the tenant's oldest due event: pending events at once, failed ones once the retry delay
   * for the attempts they have used has passed. Rows another dispatcher is claiming are skipped, so
   * no event is claimed twice. The tenant is filtered explicitly, so claiming does not depend on
   * row-level security alone.
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
              lt(outboxEvents.updatedAt, this.retryDueBefore()),
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
        createdAt: outboxEvents.createdAt,
      });

    if (!claimedEvent) return null;

    const { claimId } = claimedEvent;

    if (!claimId) throw new Error(`Outbox event ${claimedEvent.id} was claimed without a claim id`);

    return { ...claimedEvent, claimId };
  }

  /**
   * Counts claims left behind by a dispatcher that stopped mid-delivery as failed attempts, so they
   * are retried with backoff and an event that keeps crashing its dispatcher eventually goes dead.
   * Events a running handler has locked are skipped instead of waited for. The claim is cleared, so
   * a dispatcher that was only slow can no longer write over the released event.
   */
  async releaseStalledClaims(tenantId: UUIDType): Promise<void> {
    const stalledEventIds = this.db
      .select({ id: outboxEvents.id })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.tenantId, tenantId),
          eq(outboxEvents.status, OUTBOX_STATUSES.PROCESSING),
          lt(outboxEvents.updatedAt, this.secondsAgo(OUTBOX_STALLED_CLAIM_SECONDS)),
        ),
      )
      .for("update", { skipLocked: true });

    await this.db
      .update(outboxEvents)
      .set({
        status: sql`CASE WHEN ${outboxEvents.attemptCount} + 1 >= ${OUTBOX_MAX_ATTEMPTS} THEN ${OUTBOX_STATUSES.DEAD} ELSE ${OUTBOX_STATUSES.FAILED} END`,
        attemptCount: sql`${outboxEvents.attemptCount} + 1`,
        lastError: OUTBOX_ABANDONED_CLAIM_ERROR,
        claimId: null,
        updatedAt: sql`NOW()`,
      })
      .where(inArray(outboxEvents.id, stalledEventIds));
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

  /**
   * Remembers that one handler succeeded, so retries skip it. The wall clock refreshes the claim,
   * since NOW() would be the start of a handler transaction that may have run for minutes.
   */
  async recordSucceededHandler(claim: OutboxClaim, handlerName: string): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        succeededHandlers: sql`${outboxEvents.succeededHandlers} || jsonb_build_array(${handlerName}::text)`,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(this.isOwnClaim(claim));
  }

  /** Keeps a claim fresh after a handler failed, whose rolled-back transaction refreshed nothing. */
  async refreshClaim(claim: OutboxClaim): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({ updatedAt: sql`clock_timestamp()` })
      .where(and(this.isOwnClaim(claim), eq(outboxEvents.status, OUTBOX_STATUSES.PROCESSING)));
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
    return and(eq(outboxEvents.id, id), eq(outboxEvents.claimId, claimId));
  }

  private secondsAgo(seconds: number) {
    return sql`NOW() - make_interval(secs => ${seconds})`;
  }

  /** The moment before which a failed event's last attempt must have ended for it to be due. */
  private retryDueBefore() {
    const retryDelays = sql.raw(`ARRAY[${OUTBOX_RETRY_DELAYS_SECONDS.join(", ")}]`);

    return sql`NOW() - make_interval(secs => (${retryDelays})[LEAST(${outboxEvents.attemptCount}, ${OUTBOX_RETRY_DELAYS_SECONDS.length})])`;
  }
}
