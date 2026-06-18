import { Test } from "@nestjs/testing";

import { EmailService } from "src/common/emails/emails.service";
import { CourseService } from "src/courses/course.service";
import { UsersImportInviteEmailsEvent } from "src/events/user/users-import-invite-emails.event";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsService } from "src/statistics/statistics.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { NotifyUsersHandler } from "src/user/handlers/notify-users.handler";
import { UserService } from "src/user/user.service";

describe("NotifyUsersHandler", () => {
  let handler: NotifyUsersHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotifyUsersHandler,
        { provide: DB_ADMIN, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: CourseService, useValue: {} },
        { provide: StatisticsService, useValue: {} },
        { provide: SettingsService, useValue: { getGlobalSettings: jest.fn() } },
        { provide: TenantDbRunnerService, useValue: {} },
      ],
    }).compile();

    handler = module.get(NotifyUsersHandler);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends import invite emails in batches of 5", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const notifyUserAboutInvite = jest
      .spyOn(handler, "notifyUserAboutInvite")
      .mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);

        await new Promise((resolve) => setTimeout(resolve, 0));

        inFlight -= 1;
      });

    const event = new UsersImportInviteEmailsEvent({
      tenantId: "00000000-0000-0000-0000-000000000001",
      creatorId: "00000000-0000-0000-0000-000000000002",
      recipients: Array.from({ length: 45 }, (_, index) => ({
        email: `imported-${index}@example.com`,
        userId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
        token: `token-${index}`,
      })),
    });

    await handler.notifyUsersAboutImportInvites(event);

    expect(notifyUserAboutInvite).toHaveBeenCalledTimes(45);
    expect(maxInFlight).toBe(5);
  });
});
