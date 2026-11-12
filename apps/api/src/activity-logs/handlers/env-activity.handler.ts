import { Injectable } from "@nestjs/common";

import { UpdateEnvEvent } from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type EnvEventType = UpdateEnvEvent;

@Injectable()
@OutboxEventsHandler(UpdateEnvEvent)
export class EnvActivityHandler implements OutboxEventsHandlerOf<EnvEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handleOutboxEvent(event: EnvEventType) {
    if (event instanceof UpdateEnvEvent) return await this.handleUpdate(event);
  }

  private async handleUpdate(event: UpdateEnvEvent) {
    const envKeys = event.updateEnvData.updatedEnvKeys ?? [];

    await this.activityLogsService.recordActivity({
      actor: event.updateEnvData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.INTEGRATION,
      resourceId: null,
      changedFields: envKeys,
    });
  }
}
