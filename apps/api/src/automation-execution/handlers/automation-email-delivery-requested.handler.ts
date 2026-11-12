import { Injectable } from "@nestjs/common";

import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { AutomationEmailDeliveryRequestedEvent } from "../events/notification-event";
import { AutomationRunCreationService } from "../services/automation-run-creation.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(AutomationEmailDeliveryRequestedEvent)
export class AutomationEmailDeliveryRequestedHandler
  implements OutboxEventsHandlerOf<AutomationEmailDeliveryRequestedEvent>
{
  constructor(private readonly automationRunCreationService: AutomationRunCreationService) {}

  async handleOutboxEvent({ emailDeliveryRequestData }: AutomationEmailDeliveryRequestedEvent) {
    await this.automationRunCreationService.enqueueAutomationEmailDelivery(
      emailDeliveryRequestData.emailDeliveryId,
    );
  }
}
