import { setTimeout as delay } from "node:timers/promises";

import { ne, sql } from "drizzle-orm";

import { OutboxDispatcherService } from "src/outbox/outbox-dispatcher.service";
import { OUTBOX_STATUSES } from "src/outbox/outbox.types";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { outboxEvents } from "src/storage/schema";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

/**
 * Delivers every due outbox event. Jest does not start the dispatcher, so tests call this before
 * asserting a handler's side effects. Events published by handlers are delivered in the same pass.
 */
export async function dispatchOutbox(app: INestApplication): Promise<void> {
  await app.get(OutboxDispatcherService, { strict: false }).dispatchPendingEvents();
}

/** Dispatch persisted events while polling because Jest does not start outbox consumers. */
export async function waitForOutbox<T>(
  app: INestApplication,
  fetcher: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 15000,
  intervalMs = 250,
): Promise<T> {
  const outboxDispatcherService = app.get(OutboxDispatcherService, { strict: false });
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await outboxDispatcherService.dispatchPendingEvents();
    const value = await fetcher();
    if (predicate(value)) return value;

    await delay(intervalMs);
  }

  throw new Error(
    `Timed out waiting for outbox-driven condition. ${await describeUndeliveredEvents(app)}`,
  );
}

/**
 * Names the outbox events that are still waiting or gave up, and the database sessions that are
 * blocked or holding a transaction open, so a timeout says which handler failed or hung.
 */
export async function describeUndeliveredEvents(app: INestApplication): Promise<string> {
  const dbAdmin = app.get<DatabasePg>(DB_ADMIN, { strict: false });
  const undelivered = await dbAdmin
    .select({
      eventType: outboxEvents.eventType,
      status: outboxEvents.status,
      attemptCount: outboxEvents.attemptCount,
      succeededHandlers: outboxEvents.succeededHandlers,
      lastError: outboxEvents.lastError,
    })
    .from(outboxEvents)
    .where(ne(outboxEvents.status, OUTBOX_STATUSES.PUBLISHED));
  const stuckSessions = await dbAdmin.execute(sql`
    SELECT state, wait_event_type, wait_event,
      pg_blocking_pids(pid) AS blocked_by,
      left(regexp_replace(query, '\s+', ' ', 'g'), 300) AS query
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND (wait_event_type = 'Lock' OR state = 'idle in transaction')
  `);

  const deliveryState = undelivered.length
    ? `Undelivered outbox events: ${JSON.stringify(undelivered)}`
    : "Every outbox event was delivered.";

  return `${deliveryState} Blocked or open database sessions: ${JSON.stringify(stuckSessions)}`;
}
