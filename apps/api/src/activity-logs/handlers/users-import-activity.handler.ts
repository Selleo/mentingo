import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { UsersImportEvent } from "src/events/user/users-import.event";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

@Injectable()
@EventsHandler(UsersImportEvent)
export class UsersImportActivityHandler implements IEventHandler<UsersImportEvent> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: UsersImportEvent) {
    const { actor, tenantId, importedUsers, skippedRows, importedUsersCount, skippedRowsCount } =
      event.usersImport;

    await this.activityLogsService.recordActivity({
      actor,
      tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.USERS_IMPORT,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: null,
      context: {
        importedUsersCount: String(importedUsersCount),
        skippedRowsCount: String(skippedRowsCount),
        importedUserIds: JSON.stringify(importedUsers.map(({ userId }) => userId)),
        importedEmails: JSON.stringify(importedUsers.map(({ email }) => email)),
        skippedRows: JSON.stringify(skippedRows),
      },
    });
  }
}
