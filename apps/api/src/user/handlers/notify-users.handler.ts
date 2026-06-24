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
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { buildCreateNewPasswordLink } from "src/common/helpers/buildCreateNewPasswordLink";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { CourseService } from "src/courses/course.service";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { UserFirstLoginEvent } from "src/events/user/user-first-login.event";
import { UserInviteEvent } from "src/events/user/user-invite.event";
import { UsersLongInactivityEvent } from "src/events/user/user-long-inactivity.event";
import { UserPasswordEmailsEvent } from "src/events/user/user-password-emails.event";
import { UserPasswordReminderEvent } from "src/events/user/user-password-reminder.event";
import { UsersShortInactivityEvent } from "src/events/user/user-short-inactivity.event";
import { UserWelcomeEvent } from "src/events/user/user-welcome.event";
import { UsersImportInviteEmailsEvent } from "src/events/user/users-import-invite-emails.event";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsService } from "src/statistics/statistics.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { courses, users } from "src/storage/schema";
import { UserService } from "src/user/user.service";

import type { IEventHandler } from "@nestjs/cqrs";
import type { InactiveUsers } from "src/events/user/user-short-inactivity.event";
import type { UserEmailTriggersSchema } from "src/settings/schemas/settings.schema";

type EventType =
  | UserInviteEvent
  | UserFirstLoginEvent
  | UserPasswordReminderEvent
  | UserPasswordEmailsEvent
  | UserWelcomeEvent
  | UsersAssignedToCourseEvent
  | UsersImportInviteEmailsEvent
  | UsersShortInactivityEvent
  | UsersLongInactivityEvent
  | UserChapterFinishedEvent
  | UserCourseFinishedEvent;

const UserNotificationEvents = [
  UserInviteEvent,
  UserFirstLoginEvent,
  UserPasswordReminderEvent,
  UserPasswordEmailsEvent,
  UserWelcomeEvent,
  UsersAssignedToCourseEvent,
  UsersImportInviteEmailsEvent,
  UsersShortInactivityEvent,
  UsersLongInactivityEvent,
  UserChapterFinishedEvent,
  UserCourseFinishedEvent,
] as const;

const USERS_IMPORT_INVITE_EMAIL_CONCURRENCY = 5;

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
    if (event instanceof UserInviteEvent) {
      await this.notifyUserAboutInvite(event);
      return;
    }

    if (event instanceof UsersImportInviteEmailsEvent) {
      await this.notifyUsersAboutImportInvites(event);
      return;
    }

    if (event instanceof UserPasswordReminderEvent) {
      await this.notifyUserAboutPasswordReminder(event);
      return;
    }

    if (event instanceof UserPasswordEmailsEvent) {
      await this.notifyUsersAboutPasswordEmails(event);
      return;
    }

    if (event instanceof UserWelcomeEvent) {
      await this.notifyUserAboutWelcome(event);
      return;
    }

    if (event instanceof UsersShortInactivityEvent) {
      await this.handleTenantEmailTrigger(
        event.usersShortInactivity.tenantId,
        "userShortInactivity",
        () => this.notifyUserAboutShortInactivity(event),
      );
      return;
    }

    if (event instanceof UsersLongInactivityEvent) {
      await this.handleTenantEmailTrigger(
        event.usersLongInactivity.tenantId,
        "userLongInactivity",
        () => this.notifyUserAboutLongInactivity(event),
      );
      return;
    }

    if (event instanceof UserFirstLoginEvent) {
      await this.handleTenantEmailTrigger(
        await this.getUserTenantId(event.userFirstLogin.userId),
        "userFirstLogin",
        () => this.notifyUserAboutFirstLogin(event),
      );
      return;
    }

    if (event instanceof UsersAssignedToCourseEvent) {
      await this.handleTenantEmailTrigger(
        await this.getCourseTenantId(event.usersAssignedToCourse.courseId),
        "userCourseAssignment",
        () => this.notifyUserAboutCourseAssignment(event),
      );
      return;
    }

    if (event instanceof UserChapterFinishedEvent) {
      await this.handleTenantEmailTrigger(
        event.chapterFinishedData.actor.tenantId,
        "userChapterFinished",
        () => this.notifyUserAboutChapterFinished(event),
      );
      return;
    }

    if (event instanceof UserCourseFinishedEvent) {
      await this.handleTenantEmailTrigger(
        event.courseFinishedData.actor.tenantId,
        "userCourseFinished",
        () => this.notifyUserAboutCourseCompleted(event),
      );
    }
  }

  private async handleTenantEmailTrigger(
    tenantId: string,
    trigger: keyof UserEmailTriggersSchema,
    sendEmail: () => Promise<void>,
  ) {
    await this.tenantRunner.runWithTenant(tenantId, async () => {
      const { userEmailTriggers } = await this.settingsService.getGlobalSettings();

      if (!userEmailTriggers[trigger]) return;

      await sendEmail();
    });
  }

  private async getUserTenantId(userId: string) {
    const [user] = await this.dbAdmin
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new Error(`Cannot resolve tenant for user ${userId}`);

    return user.tenantId;
  }

  private async getCourseTenantId(courseId: string) {
    const [course] = await this.dbAdmin
      .select({ tenantId: courses.tenantId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) throw new Error(`Cannot resolve tenant for course ${courseId}`);

    return course.tenantId;
  }

  async notifyUserAboutInvite(event: UserInviteEvent) {
    const { userInvite } = event;
    const { email, creatorId, token, userId, invitedByUserName, origin, tenantId } = userInvite;

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      const baseOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId, origin);

      const url = buildCreateNewPasswordLink(baseOrigin, {
        createToken: token,
      });

      const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
        tenantId,
        userId,
      );

      const invitingUser = creatorId
        ? await this.userService.getUserById(creatorId, this.dbAdmin)
        : null;

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

  async notifyUsersAboutImportInvites(event: UsersImportInviteEmailsEvent) {
    const { tenantId, creatorId, origin, invitedByUserName, recipients } =
      event.usersImportInviteEmails;

    await processInBatches(
      recipients,
      ({ email, userId, token }) =>
        this.notifyUserAboutInvite(
          new UserInviteEvent({
            creatorId,
            email,
            token,
            userId,
            tenantId,
            invitedByUserName,
            origin,
          }),
        ),
      {
        batchSize: USERS_IMPORT_INVITE_EMAIL_CONCURRENCY,
      },
    );
  }

  async notifyUserAboutFirstLogin(event: UserFirstLoginEvent) {
    const { userFirstLogin } = event;
    const { userId } = userFirstLogin;

    const user = await this.userService.getUserById(userId);
    const baseOrigin = await resolveTenantOrigin(this.dbAdmin, user.tenantId);

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
      user.tenantId,
      user.id,
    );

    const { text, html } = new UserFirstLoginEmail({
      name: user.firstName,
      coursesUrl: `${baseOrigin}/courses`,
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
      const baseOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId, origin);

      const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
        tenantId,
        userId,
        language,
      );

      const createPasswordLink = buildCreateNewPasswordLink(baseOrigin, {
        createToken: token,
      });

      const { text, html } = new CreatePasswordReminderEmail({
        createPasswordLink,
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

  async notifyUsersAboutPasswordEmails(event: UserPasswordEmailsEvent) {
    const { emails } = event.userPasswordEmails;

    await processInBatches(
      emails,
      ({ to, subject, text, html, tenantId }) =>
        this.emailService.sendEmailWithLogo(
          {
            to,
            subject,
            text,
            html,
          },
          { tenantId },
        ),
      { batchSize: EMAIL_BATCH_SIZE },
    );
  }

  async notifyUserAboutWelcome(event: UserWelcomeEvent) {
    const { userWelcome } = event;
    const { email, userId, tenantId, origin } = userWelcome;

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      const baseOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId, origin);

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

  async notifyUserAboutCourseAssignment(event: UsersAssignedToCourseEvent) {
    const { usersAssignedToCourse } = event;
    const { courseId, studentIds } = usersAssignedToCourse;

    const { courseName } = await this.courseService.getCourseEmailData(courseId);

    const dueDatesByStudent = await this.courseService.getStudentsDueDatesForCourse(
      courseId,
      studentIds,
    );

    const studentContacts = await this.userService.getStudentEmailsByIds(studentIds);

    await processInBatches(
      studentContacts,
      async ({ id: studentId, email }) => {
        const student = await this.userService.getUserById(studentId);
        const baseOrigin = await resolveTenantOrigin(this.dbAdmin, student.tenantId);

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          student.tenantId,
          studentId,
        );

        const { text, html } = new UserAssignedToCourseEmail({
          courseName,
          courseLink: `${baseOrigin}/course/${courseId}`,
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
      },
      { batchSize: EMAIL_BATCH_SIZE, throwOnError: false },
    );
  }

  async notifyUserAboutShortInactivity(event: UsersShortInactivityEvent) {
    const { usersShortInactivity } = event;
    const { users } = usersShortInactivity;

    const recentCourses = await this.getRecentCourses(users);

    await processInBatches(
      users,
      async (user) => {
        const course = recentCourses.find((course) => course.studentId == user.userId);
        const courseName = course?.courseName;
        const student = await this.userService.getUserById(user.userId);
        const baseOrigin = await resolveTenantOrigin(this.dbAdmin, student.tenantId);

        const courseLink = course?.courseId
          ? `${baseOrigin}/course/${course.courseId}`
          : `${baseOrigin}/courses`;

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          student.tenantId,
          user.userId,
        );

        const { text, html } = new UserShortInactivityEmail({
          courseName,
          courseLink,
          ...defaultEmailSettings,
        });

        return this.emailService.sendEmailWithLogo(
          {
            to: user.email,
            subject: courseName
              ? getEmailSubject("userShortInactivityEmail", defaultEmailSettings.language, {
                  courseName,
                })
              : getEmailSubject("userShortInactivityPlatformEmail", defaultEmailSettings.language),
            text,
            html,
          },
          { tenantId: student.tenantId },
        );
      },
      { batchSize: EMAIL_BATCH_SIZE },
    );
  }

  async notifyUserAboutLongInactivity(event: UsersLongInactivityEvent) {
    const { usersLongInactivity } = event;
    const { users } = usersLongInactivity;

    const recentCourses = await this.getRecentCourses(users);

    await processInBatches(
      users,
      async (user) => {
        const course = recentCourses.find((course) => course.studentId == user.userId);

        const student = await this.userService.getUserById(user.userId);
        const baseOrigin = await resolveTenantOrigin(this.dbAdmin, student.tenantId);
        const courseLink = course?.courseId
          ? `${baseOrigin}/course/${course.courseId}`
          : `${baseOrigin}/courses`;
        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          student.tenantId,
          user.userId,
        );

        const { text, html } = new UserLongInactivityEmail({
          courseName: course?.courseName,
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
      },
      { batchSize: EMAIL_BATCH_SIZE },
    );
  }

  async notifyUserAboutChapterFinished(event: UserChapterFinishedEvent) {
    const { chapterFinishedData } = event;
    const user = await this.userService.getUserById(chapterFinishedData.userId);
    const chapterName = await this.courseService.getChapterName(chapterFinishedData.chapterId);
    const { courseName } = await this.courseService.getCourseEmailData(
      chapterFinishedData.courseId,
    );

    const baseOrigin = await resolveTenantOrigin(this.dbAdmin, chapterFinishedData.actor.tenantId);
    const courseLink = `${baseOrigin}/course/${chapterFinishedData.courseId}`;

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
    const baseOrigin = await resolveTenantOrigin(this.dbAdmin, courseFinishedData.actor.tenantId);
    const { courseName, hasCertificate } = await this.courseService.getCourseEmailData(
      courseFinishedData.courseId,
    );

    const buttonLink = hasCertificate
      ? `${baseOrigin}/profile/${user.id}`
      : `${baseOrigin}/courses`;

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
