import { AsyncLocalStorage } from "node:async_hooks";

/** The event a handler is delivering; `occurredAt` is when its outbox row was published. */
export type OutboxDeliveryAlsContext = { occurredAt: string };

export const outboxDeliveryAls = new AsyncLocalStorage<OutboxDeliveryAlsContext>();
