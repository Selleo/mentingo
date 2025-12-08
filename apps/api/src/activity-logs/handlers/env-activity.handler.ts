import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { UpdateEnvEvent } from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

type EnvEventType = UpdateEnvEvent;

@Injectable()
@EventsHandler(UpdateEnvEvent)
export class EnvActivityHandler implements IEventHandler<EnvEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: EnvEventType) {
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
