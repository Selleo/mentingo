import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  AUTOMATION_FIELD_SENSITIVITIES,
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_RECIPIENT_TYPES,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  type AutomationSendEmailStep,
} from "@repo/shared";

import { findAutomationEventDefinition } from "src/automations/catalog/automation-event-catalog";
import { getAccountActionPlaceholderNames } from "src/automations/mappers/automation-mapping";

import { AutomationRecipientRepository } from "../repositories/automation-recipient.repository";

import type { NotificationEventItem, NotificationRecipient } from "../automation-execution.types";
import type { NotificationEvent } from "../events/notification-event";
import type { DatabasePg } from "src/common";

@Injectable()
export class AutomationRecipientResolverService {
  constructor(private readonly automationRecipientRepository: AutomationRecipientRepository) {}

  async resolveAutomationRecipients(
    step: AutomationSendEmailStep,
    event: NotificationEvent,
    transaction: DatabasePg,
  ): Promise<NotificationRecipient[]> {
    const selection = step.config.recipients ?? { type: AUTOMATION_RECIPIENT_TYPES.EVENT };

    if (selection.type === AUTOMATION_RECIPIENT_TYPES.EVENT) {
      return event.recipients;
    }

    const eventDefinition = findAutomationEventDefinition(event.kind);

    if (
      eventDefinition &&
      getAccountActionPlaceholderNames(eventDefinition, step.config.mappings ?? {}).length > 0
    ) {
      return [];
    }

    const users = await this.automationRecipientRepository.listAutomationRecipients(
      selection,
      transaction,
    );

    const items = event.items
      ? [...new Map(event.items.map((item) => [item.itemId, item])).values()]
      : this.deduplicateNotificationItemsFromRecipients(event);

    const sensitiveFields = new Set(
      eventDefinition?.fields
        .filter((field) => field.sensitivity === AUTOMATION_FIELD_SENSITIVITIES.ACCOUNT_ACTION_LINK)
        .map((field) => field.key),
    );

    const snapshotIds = this.indexOriginalRecipientOccurrences(event);

    const itemRepetitions = new Map<string, number>();

    const usesRecipientIdentityFields = this.usesRecipientIdentityFields(event);

    return items.flatMap((item) => {
      const fieldId = this.hashNotificationItemFields(item.eventFields, event);
      const index = itemRepetitions.get(fieldId) ?? 0;

      itemRepetitions.set(fieldId, index + 1);

      return users.map((user) => ({
        itemId:
          snapshotIds.get(`${fieldId}:${user.email}:${index}`) ??
          `selected:${fieldId}:${user.email}:${index}`,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        language:
          user.language && isSupportedLanguage(user.language)
            ? user.language
            : SUPPORTED_LANGUAGES.EN,
        // These fields describe the source event, including its learner, rather than its destination.
        eventFields: {
          ...Object.fromEntries(
            Object.entries(item.eventFields).filter(([key]) => !sensitiveFields.has(key)),
          ),
          ...(usesRecipientIdentityFields
            ? {
                userEmail: user.email,
                userFirstName: user.firstName,
                userLastName: user.lastName,
              }
            : {}),
        },
      }));
    });
  }

  private indexOriginalRecipientOccurrences(event: NotificationEvent): Map<string, string> {
    const snapshotIds = new Map<string, string>();
    const snapshotRepetitions = new Map<string, number>();

    for (const recipient of event.recipients) {
      const key = `${this.hashNotificationItemFields(recipient.eventFields, event)}:${
        recipient.email
      }`;

      const index = snapshotRepetitions.get(key) ?? 0;

      snapshotRepetitions.set(key, index + 1);
      snapshotIds.set(`${key}:${index}`, recipient.itemId);
    }

    return snapshotIds;
  }

  private deduplicateNotificationItemsFromRecipients(
    event: NotificationEvent,
  ): NotificationEventItem[] {
    const items = new Map<string, NotificationEventItem>();
    const repetitions = new Map<string, number>();

    for (const recipient of event.recipients) {
      const fieldId = this.hashNotificationItemFields(recipient.eventFields, event);
      const sourceKey = `${fieldId}:${recipient.email}`;
      const index = repetitions.get(sourceKey) ?? 0;
      const itemId = `${fieldId}:${index}`;

      repetitions.set(sourceKey, index + 1);
      items.set(itemId, { itemId, eventFields: recipient.eventFields });
    }

    return [...items.values()];
  }

  private usesRecipientIdentityFields(event: NotificationEvent): boolean {
    return (
      [
        AUTOMATION_EVENT_KINDS.ADMIN_OVERDUE_COURSES,
        AUTOMATION_EVENT_KINDS.ANNOUNCEMENT,
        AUTOMATION_EVENT_KINDS.LIVE_TRAINING_STARTED,
        AUTOMATION_EVENT_KINDS.LIVE_TRAINING_REMINDER,
        AUTOMATION_EVENT_KINDS.LIVE_TRAINING_ENDED,
      ] as string[]
    ).includes(event.kind);
  }

  private hashNotificationItemFields(
    fields: NotificationEventItem["eventFields"],
    event: NotificationEvent,
  ): string {
    const audienceFields = this.usesRecipientIdentityFields(event)
      ? new Set(["userEmail", "userFirstName", "userLastName"])
      : new Set<string>();

    return createHash("sha256")
      .update(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(fields)
              .filter(([key]) => !audienceFields.has(key))
              .sort(([left], [right]) => left.localeCompare(right)),
          ),
        ),
      )
      .digest("hex");
  }
}
