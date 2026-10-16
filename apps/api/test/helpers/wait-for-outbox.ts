import { setTimeout as delay } from "node:timers/promises";

import { OutboxDispatcherService } from "src/outbox/outbox-dispatcher.service";

import type { INestApplication } from "@nestjs/common";

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

  throw new Error("Timed out waiting for outbox-driven condition");
}
