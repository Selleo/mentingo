import { SetMetadata } from "@nestjs/common";

import { OUTBOX_EVENT_OPTIONS_METADATA, OUTBOX_EVENTS_HANDLER_METADATA } from "./outbox.constants";

import type { OutboxEventClass, OutboxEventOptions } from "./outbox.types";

/**
 * Subscribes a provider to outbox events. After the publishing transaction commits, the dispatcher
 * awaits its `handleOutboxEvent` for each of them, retrying it until it succeeds or gives up.
 */
export const OutboxEventsHandler = (...eventClasses: OutboxEventClass[]) =>
  SetMetadata(OUTBOX_EVENTS_HANDLER_METADATA, eventClasses);

/** Declares how the outbox stores an event, for events whose payload must not be kept. */
export const OutboxEvent = (options: OutboxEventOptions) =>
  SetMetadata(OUTBOX_EVENT_OPTIONS_METADATA, options);
