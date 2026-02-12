import { Inject } from "@nestjs/common";
import { EventsHandler } from "@nestjs/cqrs";
import {
  CreatePasswordReminderEmail,
  WelcomeEmail,
  UserFirstLoginEmail,
  UserAssignedToCourseEmail,
  UserInviteEmail,
  UserShortInactivityEmail,
  UserLongInactivityEmail,
  UserFinishedChapterEmail,
  UserFinishedCourseEmail,
} from "@repo/email-templates";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { CourseService } from "src/courses/course.service";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { UserFirstLoginEvent } from "src/events/user/user-first-login.event";
import { UserInviteEvent } from "src/events/user/user-invite.event";
import { UsersLongInactivityEvent } from "src/events/user/user-long-inactivity.event";
import { UserPasswordReminderEvent } from "src/events/user/user-password-reminder.event";
import { UsersShortInactivityEvent } from "src/events/user/user-short-inactivity.event";
import { UserWelcomeEvent } from "src/events/user/user-welcome.event";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsService } from "src/statistics/statistics.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { tenants } from "src/storage/schema";
import { UserService } from "src/user/user.service";

import type { IEventHandler } from "@nestjs/cqrs";
import type { InactiveUsers } from "src/events/user/user-short-inactivity.event";
import type { UserEmailTriggersSchema } from "src/settings/schemas/settings.schema";

type EventType =
  | UserInviteEvent
  | UserFirstLoginEvent
  | UserPasswordReminderEvent
  | UserWelcomeEvent
  | UsersAssignedToCourseEvent
  | UsersShortInactivityEvent
  | UsersLongInactivityEvent
  | UserChapterFinishedEvent
  | UserCourseFinishedEvent;

const UserNotificationEvents = [
  UserInviteEvent,
  UserFirstLoginEvent,
  UserPasswordReminderEvent,
  UserWelcomeEvent,
  UsersAssignedToCourseEvent,
  UsersShortInactivityEvent,
  UsersLongInactivityEvent,
  UserChapterFinishedEvent,
  UserCourseFinishedEvent,
] as const;

const eventTriggerMap: Record<string, keyof UserEmailTriggersSchema> = {
  UserFirstLoginEvent: "userFirstLogin",
  UsersAssignedToCourseEvent: "userCourseAssignment",
  UsersShortInactivityEvent: "userShortInactivity",
  UsersLongInactivityEvent: "userLongInactivity",
  UserChapterFinishedEvent: "userChapterFinished",
  UserCourseFinishedEvent: "userCourseFinished",
};

@EventsHandler(...UserNotificationEvents)
export class NotifyUsersHandler implements IEventHandler {
  constructor(
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly statisticsService: StatisticsService,
    private readonly settingsService: SettingsService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async handle(event: EventType) {
    const { userEmailTriggers } = await this.settingsService.getGlobalSettings();

    if (event instanceof UserInviteEvent) {
      await this.notifyUserAboutInvite(event);
      return;
    }

    if (event instanceof UserPasswordReminderEvent) {
      await this.notifyUserAboutPasswordReminder(event);
      return;
    }

    if (event instanceof UserWelcomeEvent) {
      await this.notifyUserAboutWelcome(event);
      return;
    }

    if (!userEmailTriggers[eventTriggerMap[event.constructor.name]]) return;

    if (event instanceof UserFirstLoginEvent) {
      await this.notifyUserAboutFirstLogin(event);
    }

    if (event instanceof UsersAssignedToCourseEvent) {
      await this.notifyUserAboutCourseAssignment(event);
    }

    if (event instanceof UsersShortInactivityEvent) {
      await this.notifyUserAboutShortInactivity(event);
    }

    if (event instanceof UsersLongInactivityEvent) {
      await this.notifyUserAboutLongInactivity(event);
    }

    if (event instanceof UserChapterFinishedEvent) {
      await this.notifyUserAboutChapterFinished(event);
    }

    if (event instanceof UserCourseFinishedEvent) {
      await this.notifyUserAboutCourseCompleted(event);
    }
  }

  async notifyUserAboutInvite(event: UserInviteEvent) {
    const { userInvite } = event;
    const { email, creatorId, token, userId, invitedByUserName, origin, tenantId } = userInvite;

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      const baseOrigin = await this.resolveTenantOrigin(tenantId, origin);
      const url = `${baseOrigin}/auth/create-new-password?createToken=${token}&email=${email}`;

      const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
        tenantId,
        userId,
      );

      const invitingUser = creatorId ? await this.userService.getUserById(creatorId) : null;

      const invitingUsername =
        invitedByUserName || `${invitingUser?.firstName} ${invitingUser?.lastName}` || "Admin";

      const { text, html } = new UserInviteEmail({
        invitedByUserName: invitingUsername,
        createPasswordLink: url,
        ...defaultEmailSettings,
      });

      await this.emailService.sendEmailWithLogo(
        {
          to: email,
          subject: getEmailSubject("userInviteEmail", defaultEmailSettings.language),
          text,
          html,
        },
        { tenantId },
      );
    });
  }

  async notifyUserAboutFirstLogin(event: UserFirstLoginEvent) {
    const { userFirstLogin } = event;
    const { userId } = userFirstLogin;

    const user = await this.userService.getUserById(userId);

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
      user.tenantId,
      user.id,
    );

    const { text, html } = new UserFirstLoginEmail({
      name: user.firstName,
      coursesUrl: `${process.env.CORS_ORIGIN}/courses`,
      ...defaultEmailSettings,
    });

    await this.emailService.sendEmailWithLogo(
      {
        to: user.email,
        subject: getEmailSubject("userFirstLoginEmail", defaultEmailSettings.language),
        text,
        html,
      },
      { tenantId: user.tenantId },
    );
  }

  async notifyUserAboutPasswordReminder(event: UserPasswordReminderEvent) {
    const { userPasswordReminder } = event;
    const { email, token, userId, tenantId, language, origin } = userPasswordReminder;

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      const baseOrigin = await this.resolveTenantOrigin(tenantId, origin);

      const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
        tenantId,
        userId,
        language,
      );

      const { text, html } = new CreatePasswordReminderEmail({
        createPasswordLink: `${baseOrigin}/auth/create-new-password?createToken=${token}&email=${email}`,
        ...defaultEmailSettings,
      });

      await this.emailService.sendEmailWithLogo(
        {
          to: email,
          subject: getEmailSubject("passwordReminderEmail", defaultEmailSettings.language),
          text,
          html,
        },
        { tenantId },
      );
    });
  }

  async notifyUserAboutWelcome(event: UserWelcomeEvent) {
    const { userWelcome } = event;
    const { email, userId, tenantId, origin } = userWelcome;

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      const baseOrigin = await this.resolveTenantOrigin(tenantId, origin);

      const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
        tenantId,
        userId,
      );

      const { text, html } = new WelcomeEmail({
        coursesLink: `${baseOrigin}/courses`,
        ...defaultEmailSettings,
      });

      await this.emailService.sendEmailWithLogo(
        {
          to: email,
          subject: getEmailSubject("welcomeEmail", defaultEmailSettings.language),
          text,
          html,
        },
        { tenantId },
      );
    });
  }

  private async resolveTenantOrigin(tenantId: string, fallbackOrigin?: string) {
    if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");

    const [tenant] = await this.dbAdmin
      .select({ host: tenants.host })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant?.host?.replace(/\/$/, "") || process.env.CORS_ORIGIN || "http://localhost:5173";
  }

  async notifyUserAboutCourseAssignment(event: UsersAssignedToCourseEvent) {
    const { usersAssignedToCourse } = event;
    const { courseId, studentIds } = usersAssignedToCourse;

    const courseLink = `${process.env.CORS_ORIGIN}/course/${courseId}`;
    const { courseName } = await this.courseService.getCourseEmailData(courseId);

    const dueDatesByStudent = await this.courseService.getStudentsDueDatesForCourse(
      courseId,
      studentIds,
    );

    const studentContacts = await this.userService.getStudentEmailsByIds(studentIds);

    await Promise.allSettled(
      studentContacts.map(async ({ id: studentId, email }) => {
        const student = await this.userService.getUserById(studentId);

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          student.tenantId,
          studentId,
        );

        const { text, html } = new UserAssignedToCourseEmail({
          courseName,
          courseLink,
          formatedCourseDueDate: dueDatesByStudent[studentId] ?? null,
          ...defaultEmailSettings,
        });

        return await this.emailService.sendEmailWithLogo(
          {
            to: email,
            subject: getEmailSubject("userCourseAssignmentEmail", defaultEmailSettings.language, {
              courseName,
            }),
            text,
            html,
          },
          { tenantId: student.tenantId },
        );
      }),
    );
  }

  async notifyUserAboutShortInactivity(event: UsersShortInactivityEvent) {
    const { usersShortInactivity } = event;
    const { users } = usersShortInactivity;

    const recentCourses = await this.getRecentCourses(users);

    await Promise.allSettled(
      users.map(async (user) => {
        const course = recentCourses.find((course) => course.studentId == user.userId);
        const courseLink = `${process.env.CORS_ORIGIN}/course/${course?.courseId}`;

        const student = await this.userService.getUserById(user.userId);

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          student.tenantId,
          user.userId,
        );

        const { text, html } = new UserShortInactivityEmail({
          courseName: course?.courseName ?? "",
          courseLink,
          ...defaultEmailSettings,
        });

        return this.emailService.sendEmailWithLogo(
          {
            to: user.email,
            subject: getEmailSubject("userShortInactivityEmail", defaultEmailSettings.language, {
              courseName: course?.courseName ?? "",
            }),
            text,
            html,
          },
          { tenantId: student.tenantId },
        );
      }),
    );
  }

  async notifyUserAboutLongInactivity(event: UsersLongInactivityEvent) {
    const { usersLongInactivity } = event;
    const { users } = usersLongInactivity;

    const recentCourses = await this.getRecentCourses(users);

    await Promise.allSettled(
      users.map(async (user) => {
        const course = recentCourses.find((course) => course.studentId == user.userId);

        if (!course) return;

        const courseLink = `${process.env.CORS_ORIGIN}/course/${course?.courseId}`;

        const student = await this.userService.getUserById(user.userId);
        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          student.tenantId,
          user.userId,
        );

        const { text, html } = new UserLongInactivityEmail({
          courseName: course.courseName,
          courseLink,
          ...defaultEmailSettings,
        });

        return this.emailService.sendEmailWithLogo(
          {
            to: user.email,
            subject: getEmailSubject("userLongInactivityEmail", defaultEmailSettings.language),
            text,
            html,
          },
          { tenantId: student.tenantId },
        );
      }),
    );
  }

  async notifyUserAboutChapterFinished(event: UserChapterFinishedEvent) {
    const { chapterFinishedData } = event;
    const user = await this.userService.getUserById(chapterFinishedData.userId);
    const chapterName = await this.courseService.getChapterName(chapterFinishedData.chapterId);
    const { courseName } = await this.courseService.getCourseEmailData(
      chapterFinishedData.courseId,
    );

    const courseLink = `${process.env.CORS_ORIGIN}/course/${chapterFinishedData.courseId}`;

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
      chapterFinishedData.actor.tenantId,
      user.id,
    );

    const { text, html } = new UserFinishedChapterEmail({
      courseName,
      courseLink,
      chapterName,
      ...defaultEmailSettings,
    });

    const subject = getEmailSubject("userChapterFinishedEmail", defaultEmailSettings.language, {
      chapterName,
    });

    await this.emailService.sendEmailWithLogo(
      {
        to: user.email,
        subject,
        html,
        text,
      },
      { tenantId: chapterFinishedData.actor.tenantId },
    );
  }

  async notifyUserAboutCourseCompleted(event: UserCourseFinishedEvent) {
    const { courseFinishedData } = event;

    const user = await this.userService.getUserById(courseFinishedData.userId);
    const { courseName, hasCertificate } = await this.courseService.getCourseEmailData(
      courseFinishedData.courseId,
    );

    const buttonLink = hasCertificate
      ? `${process.env.CORS_ORIGIN}/profile/${user.id}`
      : `${process.env.CORS_ORIGIN}/courses`;

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
      courseFinishedData.actor.tenantId,
      user.id,
    );

    const { text, html } = new UserFinishedCourseEmail({
      buttonLink,
      courseName,
      ...defaultEmailSettings,
      hasCertificate,
    });

    await this.emailService.sendEmailWithLogo(
      {
        to: user.email,
        subject: getEmailSubject("userCourseFinishedEmail", defaultEmailSettings.language, {
          courseName,
        }),
        html,
        text,
      },
      { tenantId: courseFinishedData.actor.tenantId },
    );
  }

  private async getRecentCourses(users: InactiveUsers["users"]) {
    return this.statisticsService.getRecentCoursesForStudents(users.map((user) => user.userId));
  }
}
