import { Test } from "@nestjs/testing";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { UserPasswordEmailsActivityHandler } from "src/activity-logs/handlers/user-password-emails-activity.handler";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "src/activity-logs/types";
import {
  USER_PASSWORD_EMAIL_TYPES,
  UserPasswordEmailsEvent,
} from "src/events/user/user-password-emails.event";

describe("UserPasswordEmailsActivityHandler", () => {
  it("records password reset email activity with summary context", async () => {
    const recordActivity = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        UserPasswordEmailsActivityHandler,
        {
          provide: ActivityLogsService,
          useValue: { recordActivity },
        },
      ],
    }).compile();
    const handler = module.get(UserPasswordEmailsActivityHandler);

    const actor = {
      userId: "00000000-0000-0000-0000-000000000001",
      email: "admin@example.com",
      roleSlugs: ["admin"],
      permissions: [],
      tenantId: "00000000-0000-0000-0000-000000000010",
    };
    const recipients = [
      {
        userId: "00000000-0000-0000-0000-000000000002",
        email: "student@example.com",
      },
    ];

    await handler.handle(
      new UserPasswordEmailsEvent({
        actor,
        tenantId: actor.tenantId,
        type: USER_PASSWORD_EMAIL_TYPES.RESET,
        emails: [],
        recipients,
        sentCount: 1,
        skippedCount: 2,
      }),
    );

    expect(recordActivity).toHaveBeenCalledWith({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.SEND_PASSWORD_RESET_EMAIL,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: null,
      context: {
        sentCount: "1",
        skippedCount: "2",
        recipientUserIds: JSON.stringify(["00000000-0000-0000-0000-000000000002"]),
        recipientEmails: JSON.stringify(["student@example.com"]),
      },
    });
  });

  it("records password creation email activity", async () => {
    const recordActivity = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        UserPasswordEmailsActivityHandler,
        {
          provide: ActivityLogsService,
          useValue: { recordActivity },
        },
      ],
    }).compile();
    const handler = module.get(UserPasswordEmailsActivityHandler);

    const actor = {
      userId: "00000000-0000-0000-0000-000000000001",
      email: "admin@example.com",
      roleSlugs: ["admin"],
      permissions: [],
      tenantId: "00000000-0000-0000-0000-000000000010",
    };

    await handler.handle(
      new UserPasswordEmailsEvent({
        actor,
        tenantId: actor.tenantId,
        type: USER_PASSWORD_EMAIL_TYPES.CREATION,
        emails: [],
        recipients: [],
        sentCount: 0,
        skippedCount: 1,
      }),
    );

    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: ACTIVITY_LOG_ACTION_TYPES.RESEND_PASSWORD_CREATION_EMAIL,
        context: expect.objectContaining({
          sentCount: "0",
          skippedCount: "1",
        }),
      }),
    );
  });
});
