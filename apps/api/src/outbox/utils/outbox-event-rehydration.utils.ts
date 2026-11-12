import type { OutboxEventClass } from "../outbox.types";

/**
 * Rebuilds a stored event as an instance of its class without calling its constructor, so events
 * come back whole whatever their constructor's shape, and `instanceof` keeps working in handlers.
 */
export const rehydrateOutboxEvent = <TEvent extends object>(
  eventClass: OutboxEventClass,
  payload: Record<string, unknown>,
): TEvent => Object.assign(Object.create(eventClass.prototype), payload);
