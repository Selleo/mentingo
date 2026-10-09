import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import { OutboxDirectHandlerService } from "./outbox-direct-handler.service";
import { OutboxNotificationPreparationService } from "./outbox-notification-preparation.service";
import { isOutboxProcessingEnabled } from "./outbox.constants";
import { OutboxRepository } from "./outbox.repository";

import type { OutboxPublication } from "./outbox.types";
import type { DatabasePg } from "src/common";

@Injectable()
export class OutboxPublisher {
  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly eventBus: EventBus,
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
    private readonly outboxNotificationPreparationService: OutboxNotificationPreparationService,
  ) {}

  async publish(event: object, dbInstance?: DatabasePg): Promise<void> {
    const notifications = await this.outboxNotificationPreparationService.prepare(event);
    for (const notification of notifications) {
      await this.publish(notification, dbInstance);
    }

    const publication: OutboxPublication = {
      eventType: this.getEventType(event),
      payload: this.sanitizeValue(event) as Record<string, unknown>,
    };

    if (!isOutboxProcessingEnabled()) {
      await this.publishWithoutDispatcher(event, publication, dbInstance);
      return;
    }

    await this.outboxRepository.createPending(publication, dbInstance);
    await this.outboxRepository.notifyPending(dbInstance);
  }

  private async publishWithoutDispatcher(
    event: object,
    publication: OutboxPublication,
    transaction?: DatabasePg,
  ): Promise<void> {
    if (!this.outboxDirectHandlerService.has(publication.eventType)) {
      await this.eventBus.publish(event);
      return;
    }

    // Keep the handoff durable even when direct intake replaces the dispatcher.
    const eventId = randomUUID();
    await this.outboxRepository.createPending(publication, transaction, eventId);
    await this.outboxDirectHandlerService.dispatch(
      publication.eventType,
      publication.payload,
      eventId,
      transaction,
    );
    await this.outboxRepository.markPublished(eventId, true, transaction);
  }

  private getEventType(event: object): string {
    const candidate = (event as { constructor?: { name?: string } }).constructor?.name;
    if (candidate && candidate !== "Object") return candidate;
    return "UnknownEvent";
  }

  private sanitizeValue(value: unknown): unknown {
    if (value === undefined) return null;
    if (value === null) return null;
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item));
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        this.sanitizeValue(item),
      ]);
      return Object.fromEntries(entries);
    }
    return value;
  }
}
