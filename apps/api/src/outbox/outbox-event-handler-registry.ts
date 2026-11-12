import { Injectable } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";

import { OUTBOX_EVENT_OPTIONS_METADATA, OUTBOX_EVENTS_HANDLER_METADATA } from "./outbox.constants";

import type {
  OutboxEventClass,
  OutboxEventOptions,
  OutboxEventSubscription,
  OutboxEventsHandlerOf,
} from "./outbox.types";

/** Finds the `@OutboxEventsHandler` providers subscribed to each stored event type. */
@Injectable()
export class OutboxEventHandlerRegistry {
  private subscriptionsByEventType: Map<string, OutboxEventSubscription> | null = null;

  constructor(private readonly discoveryService: DiscoveryService) {}

  /** Null for events nobody handles; they stay in the outbox only as history. */
  findEventSubscription(eventType: string): OutboxEventSubscription | null {
    this.subscriptionsByEventType ??= this.discoverEventSubscriptions();

    return this.subscriptionsByEventType.get(eventType) ?? null;
  }

  /** What `@OutboxEvent` declared for the event class, or nothing for undecorated events. */
  getEventOptions(eventClass: OutboxEventClass): OutboxEventOptions {
    return Reflect.getMetadata(OUTBOX_EVENT_OPTIONS_METADATA, eventClass) ?? {};
  }

  /** Discovered on first use, after every provider is instantiated, so no handler is missed. */
  private discoverEventSubscriptions(): Map<string, OutboxEventSubscription> {
    const subscriptionsByEventType = new Map<string, OutboxEventSubscription>();

    for (const { metatype, instance } of this.discoveryService.getProviders()) {
      const eventClasses: OutboxEventClass[] | undefined =
        metatype && Reflect.getMetadata(OUTBOX_EVENTS_HANDLER_METADATA, metatype);

      if (!eventClasses || !instance) continue;

      const handler = instance as OutboxEventsHandlerOf<object>;

      for (const eventClass of eventClasses) {
        const subscription = subscriptionsByEventType.get(eventClass.name) ?? {
          eventClass,
          handlers: [],
        };

        subscription.handlers.push({
          name: metatype.name,
          handleOutboxEvent: (event, context) => handler.handleOutboxEvent(event, context),
        });

        subscriptionsByEventType.set(eventClass.name, subscription);
      }
    }

    return subscriptionsByEventType;
  }
}
