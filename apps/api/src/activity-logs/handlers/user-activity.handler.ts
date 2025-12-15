import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { CreateUserEvent, DeleteUserEvent, UpdateUserEvent } from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type UserEventType = CreateUserEvent | UpdateUserEvent | DeleteUserEvent;

@Injectable()
@EventsHandler(CreateUserEvent, UpdateUserEvent, DeleteUserEvent)
export class UserActivityHandler implements IEventHandler<UserEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: UserEventType) {
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

  private async handleDelete(event: DeleteUserEvent) {
    const beforeSnapshot =
      event.deleteUserData.deletedUserData &&
      Object.fromEntries(
        Object.entries(event.deleteUserData.deletedUserData).map(([key, value]) => [
          key,
          value === null || value === undefined
            ? ""
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value),
        ]),
      );

    await this.activityLogsService.recordActivity({
      actor: event.deleteUserData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: event.deleteUserData.userId,
      before: (beforeSnapshot as Record<string, string>) ?? null,
      context: beforeSnapshot?.email ? { email: beforeSnapshot.email } : null,
    });
  }
}
