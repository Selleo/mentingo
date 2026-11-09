import { setTimeout as delay } from "node:timers/promises";

import { ne } from "drizzle-orm";

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

/** Names the outbox events that are still waiting or gave up, so a timeout says which handler failed. */
async function describeUndeliveredEvents(app: INestApplication): Promise<string> {
  const undelivered = await app
    .get<DatabasePg>(DB_ADMIN, { strict: false })
    .select({
      eventType: outboxEvents.eventType,
      status: outboxEvents.status,
      lastError: outboxEvents.lastError,
    })
    .from(outboxEvents)
    .where(ne(outboxEvents.status, OUTBOX_STATUSES.PUBLISHED));

  if (!undelivered.length) return "Every outbox event was delivered.";

  return `Undelivered outbox events: ${JSON.stringify(undelivered)}`;
}
