import { AutomationEventKind } from "@repo/shared";

import { UUIDType } from "src/common";

import type { NotificationEventItem, NotificationRecipient } from "../automation-execution.types";

export class NotificationEvent {
  constructor(
    public readonly occurrenceId: string,
    public readonly kind: AutomationEventKind,
    public readonly recipients: NotificationRecipient[],
    public readonly items?: NotificationEventItem[],
  ) {}
}

export class AutomationEmailDeliveryRequestedEvent {
  constructor(public readonly emailDeliveryId: UUIDType) {}
}
