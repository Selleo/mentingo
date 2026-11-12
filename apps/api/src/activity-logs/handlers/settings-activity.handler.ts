import { Injectable } from "@nestjs/common";

import { UpdateSettingsEvent } from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type SettingsEventType = UpdateSettingsEvent;

@Injectable()
@OutboxEventsHandler(UpdateSettingsEvent)
export class SettingsActivityHandler implements OutboxEventsHandlerOf<SettingsEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handleOutboxEvent(event: SettingsEventType) {
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
      actor: event.settingsUpdateData.actor,
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
