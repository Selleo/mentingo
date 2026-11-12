import { Injectable } from "@nestjs/common";

import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { NotificationEvent } from "../events/notification-event";
import { AutomationRunCreationService } from "../services/automation-run-creation.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

/** Starts the runs of every enabled automation whose trigger matches a committed notification. */
@Injectable()
@OutboxEventsHandler(NotificationEvent)
export class NotificationEventHandler implements OutboxEventsHandlerOf<NotificationEvent> {
  constructor(private readonly automationRunCreationService: AutomationRunCreationService) {}

  async handleOutboxEvent(event: NotificationEvent) {
    await this.automationRunCreationService.createAutomationRunsForNotificationEvent(
      event.notificationData,
    );
  }
}
