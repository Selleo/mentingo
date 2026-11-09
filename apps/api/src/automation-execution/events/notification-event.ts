import { OutboxEvent } from "src/outbox/outbox.decorators";

import type { NotificationEventItem, NotificationRecipient } from "../automation-execution.types";
import type { AutomationEventKind } from "@repo/shared";
import type { UUIDType } from "src/common";

export type NotificationEventData = {
  occurrenceId: string;
  kind: AutomationEventKind;
  recipients: NotificationRecipient[];
  items?: NotificationEventItem[];
};

/** Recipients carry names and emails, so the stored payload is cleared once runs are created. */
@OutboxEvent({ clearPayloadAfterDelivery: true })
export class NotificationEvent {
  constructor(public readonly notificationData: NotificationEventData) {}
}

export type AutomationEmailDeliveryRequestedData = { emailDeliveryId: UUIDType };

@OutboxEvent({ clearPayloadAfterDelivery: true })
export class AutomationEmailDeliveryRequestedEvent {
  constructor(public readonly emailDeliveryRequestData: AutomationEmailDeliveryRequestedData) {}
}
