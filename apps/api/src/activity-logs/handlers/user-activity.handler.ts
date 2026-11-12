import { Injectable } from "@nestjs/common";
import { mapValues } from "lodash";

import { CreateUserEvent, DeleteUserEvent, UpdateUserEvent } from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import {
  buildActivityLogMetadata,
  stringifyMetadataValue,
} from "../utils/build-activity-log-metadata";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type UserEventType = CreateUserEvent | UpdateUserEvent | DeleteUserEvent;

@Injectable()
@OutboxEventsHandler(CreateUserEvent, UpdateUserEvent, DeleteUserEvent)
export class UserActivityHandler implements OutboxEventsHandlerOf<UserEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handleOutboxEvent(event: UserEventType) {
    if (event instanceof CreateUserEvent) return await this.handleCreate(event);
    if (event instanceof UpdateUserEvent) return await this.handleUpdate(event);
    if (event instanceof DeleteUserEvent) return await this.handleDelete(event);
  }

  private async handleCreate(event: CreateUserEvent) {
    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: event.userCreationData.createdUserData,
      schema: "create",
    });

    await this.activityLogsService.recordActivity({
      actor: event.userCreationData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: event.userCreationData.userId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdate(event: UpdateUserEvent) {
    const metadata = buildActivityLogMetadata({
      previous: event.userUpdateData.previousUserData,
      updated: event.userUpdateData.updatedUserData,
    });

    await this.activityLogsService.recordActivity({
      actor: event.userUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: event.userUpdateData.userId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDelete({ deleteUserData }: DeleteUserEvent) {
    const { actor, userId, deletedUserData } = deleteUserData;
    const before = deletedUserData ? mapValues(deletedUserData, stringifyMetadataValue) : null;

    await this.activityLogsService.recordActivity({
      actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: userId,
      before,
      context: before?.email ? { email: before.email } : null,
    });
  }
}
