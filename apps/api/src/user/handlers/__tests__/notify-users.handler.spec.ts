import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { UserFirstLoginEvent } from "src/events/user/user-first-login.event";
import { UsersLongInactivityEvent } from "src/events/user/user-long-inactivity.event";
import { UsersShortInactivityEvent } from "src/events/user/user-short-inactivity.event";
import { DEFAULT_EMAIL_TRIGGERS } from "src/settings/constants/settings.constants";
import { NotifyUsersHandler } from "src/user/handlers/notify-users.handler";

import type { UserEmailTriggersSchema } from "src/settings/schemas/settings.schema";

type TriggerKey = keyof UserEmailTriggersSchema;
type NotificationMethod =
  | "notifyUserAboutFirstLogin"
  | "notifyUserAboutCourseAssignment"
  | "notifyUserAboutShortInactivity"
  | "notifyUserAboutLongInactivity"
  | "notifyUserAboutChapterFinished"
  | "notifyUserAboutCourseCompleted";

type TriggerCase = {
  name: string;
  trigger: TriggerKey;
  notificationMethod: NotificationMethod;
  event: () =>
    | UserFirstLoginEvent
    | UsersAssignedToCourseEvent
    | UsersShortInactivityEvent
    | UsersLongInactivityEvent
    | UserChapterFinishedEvent
    | UserCourseFinishedEvent;
  resolvedTenantId?: string;
};

const tenantId = "tenant-id";
const userId = "user-id";
const courseId = "course-id";
const chapterId = "chapter-id";

describe("NotifyUsersHandler", () => {
  const tenantRunner = {
    runWithTenant: jest.fn(async (_tenantId: string, callback: () => Promise<void>) => callback()),
  };
  const settingsService = {
    getGlobalSettings: jest.fn(),
  };
  const dbAdmin = {
    select: jest.fn(),
  };

  const handler = new NotifyUsersHandler(
    dbAdmin as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    settingsService as never,
    tenantRunner as never,
  );

  const actor = {
    userId: "actor-id",
    email: "actor@example.com",
    roleSlugs: [],
    permissions: [],
    tenantId,
  };

  const inactiveUsers = {
    tenantId,
    users: [{ userId, name: "Student", email: "student@example.com" }],
  };

  const cases: TriggerCase[] = [
    {
      name: "first login",
      trigger: "userFirstLogin",
      notificationMethod: "notifyUserAboutFirstLogin",
      event: () => new UserFirstLoginEvent({ userId }),
      resolvedTenantId: tenantId,
    },
    {
      name: "course assignment",
      trigger: "userCourseAssignment",
      notificationMethod: "notifyUserAboutCourseAssignment",
      event: () => new UsersAssignedToCourseEvent({ courseId, studentIds: [userId] }),
      resolvedTenantId: tenantId,
    },
    {
      name: "short inactivity",
      trigger: "userShortInactivity",
      notificationMethod: "notifyUserAboutShortInactivity",
      event: () => new UsersShortInactivityEvent(inactiveUsers),
    },
    {
      name: "long inactivity",
      trigger: "userLongInactivity",
      notificationMethod: "notifyUserAboutLongInactivity",
      event: () => new UsersLongInactivityEvent(inactiveUsers),
    },
    {
      name: "chapter finished",
      trigger: "userChapterFinished",
      notificationMethod: "notifyUserAboutChapterFinished",
      event: () =>
        new UserChapterFinishedEvent({
          actor,
          chapterId,
          courseId,
          userId,
        }),
    },
    {
      name: "course finished",
      trigger: "userCourseFinished",
      notificationMethod: "notifyUserAboutCourseCompleted",
      event: () =>
        new UserCourseFinishedEvent({
          actor,
          courseId,
          userId,
        }),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    dbAdmin.select.mockReturnValue({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ tenantId }]),
    });
  });

  const buildTriggers = (enabledTrigger?: TriggerKey): UserEmailTriggersSchema => ({
    ...DEFAULT_EMAIL_TRIGGERS,
    ...(enabledTrigger ? { [enabledTrigger]: true } : {}),
  });

  describe.each(cases)("$name email trigger", (testCase) => {
    it("skips the notification when the trigger is disabled", async () => {
      settingsService.getGlobalSettings.mockResolvedValue({
        userEmailTriggers: buildTriggers(),
      });
      const notificationSpy = jest
        .spyOn(handler, testCase.notificationMethod)
        .mockResolvedValue(undefined);

      await handler.handle(testCase.event());

      expect(tenantRunner.runWithTenant).toHaveBeenCalledWith(
        testCase.resolvedTenantId ?? tenantId,
        expect.any(Function),
      );
      expect(notificationSpy).not.toHaveBeenCalled();
    });

    it("sends the notification when the trigger is enabled", async () => {
      settingsService.getGlobalSettings.mockResolvedValue({
        userEmailTriggers: buildTriggers(testCase.trigger),
      });
      const event = testCase.event();
      const notificationSpy = jest
        .spyOn(handler, testCase.notificationMethod)
        .mockResolvedValue(undefined);

      await handler.handle(event);

      expect(tenantRunner.runWithTenant).toHaveBeenCalledWith(
        testCase.resolvedTenantId ?? tenantId,
        expect.any(Function),
      );
      expect(notificationSpy).toHaveBeenCalledWith(event);
    });
  });
});
