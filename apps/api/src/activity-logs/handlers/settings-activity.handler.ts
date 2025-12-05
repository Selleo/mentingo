import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { UpdateSettingsEvent } from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type SettingsEventType = UpdateSettingsEvent;

@Injectable()
@EventsHandler(UpdateSettingsEvent)
export class SettingsActivityHandler implements IEventHandler<SettingsEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: SettingsEventType) {
    if (event instanceof UpdateSettingsEvent) {
      return await this.handleUpdate(event);
    }
  }

  private async handleUpdate(event: UpdateSettingsEvent) {
    const metadata = buildActivityLogMetadata({
      previous: event.settingsUpdateData.previousSettingsData,
      updated: event.settingsUpdateData.updatedSettingsData,
      context: event.settingsUpdateData.context ?? null,
    });

    await this.activityLogsService.recordActivity({
      actorId: event.settingsUpdateData.actorId,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.SETTINGS,
      resourceId: event.settingsUpdateData.settingsId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }
}
