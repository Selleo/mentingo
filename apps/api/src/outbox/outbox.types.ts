import type { OUTBOX_HANDLER_DELIVERY_OUTCOMES } from "./outbox.constants";
import type { TSchema } from "@sinclair/typebox";
import type { outboxEvents } from "src/storage/schema";

export type OutboxEventClass = abstract new (data: never) => object;

export type OutboxDeliveryContext = { eventId: string };

/** What every `@OutboxEventsHandler` provider implements; the dispatcher awaits it per event. */
export interface OutboxEventsHandlerOf<TEvent extends object> {
  handleOutboxEvent(event: TEvent, context: OutboxDeliveryContext): Promise<void>;
}

export type OutboxEventOptions = {
  /** Clears the stored payload once every handler succeeded, for events carrying personal data. */
  clearPayloadAfterDelivery?: boolean;
  /** Checked before any handler runs; a payload that fails it is marked dead instead of retried. */
  payloadSchema?: TSchema;
};

export type OutboxRegisteredHandler = {
  name: string;
  handleOutboxEvent: (event: object, context: OutboxDeliveryContext) => Promise<void>;
};

export type OutboxEventSubscription = {
  eventClass: OutboxEventClass;
  handlers: OutboxRegisteredHandler[];
};

export type OutboxPublication = {
  eventType: string;
  payload: Record<string, unknown>;
};

export const OUTBOX_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  PUBLISHED: "published",
  FAILED: "failed",
  DEAD: "dead",
} as const;

export type OutboxStatus = (typeof OUTBOX_STATUSES)[keyof typeof OUTBOX_STATUSES];

/** A claimed event. Every claim stamps its id; only rows never claimed have none. */
export type OutboxEnvelope = Pick<
  typeof outboxEvents.$inferSelect,
  "id" | "eventType" | "payload" | "attemptCount" | "succeededHandlers" | "tenantId" | "createdAt"
> & { claimId: string };

export type OutboxHandlerDeliveryOutcome =
  (typeof OUTBOX_HANDLER_DELIVERY_OUTCOMES)[keyof typeof OUTBOX_HANDLER_DELIVERY_OUTCOMES];

/** Identifies one dispatcher's claim on an event; writes made under a lost claim change nothing. */
export type OutboxClaim = Pick<OutboxEnvelope, "id" | "claimId">;

export type OutboxFailedAttempt = {
  status: typeof OUTBOX_STATUSES.FAILED | typeof OUTBOX_STATUSES.DEAD;
  attemptCount: number;
  lastError: string;
};
