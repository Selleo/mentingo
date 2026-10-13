import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { deriveAutomationBranchFieldValues } from "@repo/shared";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { dbAls } from "src/storage/db/db-als.store";

import type {
  NotificationCaptureOptions,
  NotificationItemsByEvent,
  NotificationRecipientsByEvent,
} from "../types/notification.types";
import type { AutomationPlaceholderValue } from "@repo/shared";
import type { NotificationRecipient } from "src/automation-execution/automation-execution.types";

/** Request-local producer preparation, before durable publication; never sends mail. */
@Injectable()
export class NotificationCollectorService {
  private readonly recipientContext = new AsyncLocalStorage<NotificationRecipientsByEvent>();

  private readonly itemContext = new AsyncLocalStorage<NotificationItemsByEvent>();

  async collectNotificationEvents(prepare: () => Promise<void>): Promise<NotificationEvent[]> {
    const recipientsByEvent: NotificationRecipientsByEvent = new Map();
    const itemsByEvent: NotificationItemsByEvent = new Map();

    await this.itemContext.run(itemsByEvent, () =>
      this.recipientContext.run(recipientsByEvent, prepare),
    );

    const notifications: NotificationEvent[] = [];

    for (const eventKind of new Set([...recipientsByEvent.keys(), ...itemsByEvent.keys()])) {
      notifications.push(
        new NotificationEvent(
          randomUUID(),
          eventKind,
          recipientsByEvent.get(eventKind) ?? [],
          itemsByEvent.get(eventKind),
        ),
      );
    }

    return notifications;
  }

  captureNotificationItem(itemId: string, options: NotificationCaptureOptions): void {
    const itemsByEvent = this.itemContext.getStore();

    if (!itemsByEvent) {
      throw new Error("Notification preparation requires a collector context");
    }

    this.assertNotificationOriginatingTenant(options.tenantId);

    const template = options.template;

    if (!template) {
      throw new Error("Notification preparation requires a template field contract");
    }

    const items = itemsByEvent.get(template.event) ?? [];

    items.push({
      itemId,
      eventFields: {
        ...template.variables,
        ...deriveAutomationBranchFieldValues(
          template.event,
          template.variables as Record<string, AutomationPlaceholderValue>,
        ),
      } as Record<string, AutomationPlaceholderValue>,
    });

    itemsByEvent.set(template.event, items);
  }

  async captureNotificationRecipient(
    message: { to: string },
    options: NotificationCaptureOptions,
  ): Promise<void> {
    const recipientsByEvent = this.recipientContext.getStore();

    if (!recipientsByEvent) {
      throw new Error("Notification preparation requires a collector context");
    }

    this.assertNotificationOriginatingTenant(options.tenantId);

    const template = options.template;

    if (!template) {
      throw new Error("Notification preparation requires a template field contract");
    }

    const recipients = recipientsByEvent.get(template.event) ?? [];
    const recipient = this.createNotificationRecipient(message.to, template, recipients.length);

    recipients.push(recipient);
    recipientsByEvent.set(template.event, recipients);
  }

  private assertNotificationOriginatingTenant(originatingTenantId: string): void {
    const tenantId = dbAls.getStore()?.tenantId;

    if (tenantId && tenantId !== originatingTenantId) {
      throw new Error("Notification recipients must belong to the originating tenant");
    }
  }

  private createNotificationRecipient(
    email: string,
    template: NonNullable<NotificationCaptureOptions["template"]>,
    recipientIndex: number,
  ): NotificationRecipient {
    return {
      itemId: `${email}:${recipientIndex}`,
      email,
      language: template.language,
      eventFields: {
        ...template.variables,
        ...deriveAutomationBranchFieldValues(
          template.event,
          template.variables as Record<string, AutomationPlaceholderValue>,
        ),
      } as Record<string, AutomationPlaceholderValue>,
    };
  }
}
