import { Test } from "@nestjs/testing";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { UsersImportActivityHandler } from "src/activity-logs/handlers/users-import-activity.handler";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "src/activity-logs/types";
import { UsersImportEvent } from "src/events/user/users-import.event";

describe("UsersImportActivityHandler", () => {
  it("records one users_import activity log with import summary context", async () => {
    const recordActivity = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        UsersImportActivityHandler,
        {
          provide: ActivityLogsService,
          useValue: { recordActivity },
        },
      ],
    }).compile();
    const handler = module.get(UsersImportActivityHandler);

    const actor = {
      userId: "00000000-0000-0000-0000-000000000001",
      email: "admin@example.com",
      roleSlugs: ["admin"],
      permissions: [],
      tenantId: "00000000-0000-0000-0000-000000000010",
    };
    const importedUsers = [
      {
        email: "imported@example.com",
        userId: "00000000-0000-0000-0000-000000000002",
      },
    ];
    const skippedRows = [{ email: "skipped@example.com", reason: "already_exists" }];

    await handler.handle(
      new UsersImportEvent({
        actor,
        tenantId: actor.tenantId,
        importedUsers,
        skippedRows,
        importedUsersCount: importedUsers.length,
        skippedRowsCount: skippedRows.length,
      }),
    );

    expect(recordActivity).toHaveBeenCalledTimes(1);
    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.USERS_IMPORT,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: null,
      context: {
        importedUsersCount: "1",
        skippedRowsCount: "1",
        importedUserIds: JSON.stringify(["00000000-0000-0000-0000-000000000002"]),
        importedEmails: JSON.stringify(["imported@example.com"]),
        skippedRows: JSON.stringify(skippedRows),
      },
    });
  });
});
