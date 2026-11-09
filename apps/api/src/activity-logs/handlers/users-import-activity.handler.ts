import { Injectable } from "@nestjs/common";

import { UsersImportEvent } from "src/events/user/users-import.event";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(UsersImportEvent)
export class UsersImportActivityHandler implements OutboxEventsHandlerOf<UsersImportEvent> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handleOutboxEvent(event: UsersImportEvent) {
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
