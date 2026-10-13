import { Injectable, Inject } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { CourseService } from "src/courses/course.service";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { UserFirstLoginEvent } from "src/events/user/user-first-login.event";
import { UsersLongInactivityEvent } from "src/events/user/user-long-inactivity.event";
import { UsersShortInactivityEvent } from "src/events/user/user-short-inactivity.event";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { getNotificationUserFields } from "src/notifications/services/notification-fields";
import { OutboxNotificationPreparationService } from "src/outbox/outbox-notification-preparation.service";
import { StatisticsService } from "src/statistics/statistics.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { courses, users } from "src/storage/schema";
import { UserService } from "src/user/user.service";

import type { IEventHandler } from "@nestjs/cqrs";
import type { InactiveUsers } from "src/events/user/user-short-inactivity.event";

type EventType =
  | UserFirstLoginEvent
  | UsersAssignedToCourseEvent
  | UsersShortInactivityEvent
  | UsersLongInactivityEvent
  | UserChapterFinishedEvent
  | UserCourseFinishedEvent;

@Injectable()
export class NotifyUsersHandler implements IEventHandler {
  constructor(
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly statisticsService: StatisticsService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly notificationCollectorService: NotificationCollectorService,
    private readonly outboxNotificationPreparationService: OutboxNotificationPreparationService,
  ) {}

  onModuleInit() {
    this.outboxNotificationPreparationService.register(async (event) => {
      if (
        !(
          event instanceof UserFirstLoginEvent ||
          event instanceof UsersAssignedToCourseEvent ||
          event instanceof UsersShortInactivityEvent ||
          event instanceof UsersLongInactivityEvent ||
          event instanceof UserChapterFinishedEvent ||
          event instanceof UserCourseFinishedEvent
        )
      ) {
        return [];
      }

      return this.notificationCollectorService.collectNotificationEvents(() => this.handle(event));
    });
  }

  async handle(event: EventType) {
    if (event instanceof UsersShortInactivityEvent) {
      await this.prepareForTenant(event.usersShortInactivity.tenantId, () =>
        this.notifyUserAboutShortInactivity(event),
      );
      return;
    }

    if (event instanceof UsersLongInactivityEvent) {
      await this.prepareForTenant(event.usersLongInactivity.tenantId, () =>
        this.notifyUserAboutLongInactivity(event),
      );
      return;
    }

    if (event instanceof UserFirstLoginEvent) {
      await this.prepareForTenant(await this.getUserTenantId(event.userFirstLogin.userId), () =>
        this.notifyUserAboutFirstLogin(event),
      );
      return;
    }

    if (event instanceof UsersAssignedToCourseEvent) {
      await this.prepareForTenant(
        await this.getCourseTenantId(event.usersAssignedToCourse.courseId),
        () => this.notifyUserAboutCourseAssignment(event),
      );
      return;
    }

    if (event instanceof UserChapterFinishedEvent) {
      await this.prepareForTenant(event.chapterFinishedData.actor.tenantId, () =>
        this.notifyUserAboutChapterFinished(event),
      );
      return;
    }

    if (event instanceof UserCourseFinishedEvent) {
      await this.prepareForTenant(event.courseFinishedData.actor.tenantId, () =>
        this.notifyUserAboutCourseCompleted(event),
      );
    }
  }

  private async prepareForTenant(tenantId: string, prepare: () => Promise<void>) {
    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      await prepare();
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

  async notifyUserAboutFirstLogin(event: UserFirstLoginEvent) {
    const { userFirstLogin } = event;
    const { userId } = userFirstLogin;

    const user = await this.userService.getUserById(userId);
    const baseOrigin = await resolveTenantOrigin(this.dbAdmin, user.tenantId);

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
      user.tenantId,
      user.id,
    );

    await this.notificationCollectorService.captureNotificationRecipient(
      { to: user.email },
      {
        tenantId: user.tenantId,
        template: {
          event: EMAIL_TEMPLATE_EVENTS.USER_FIRST_LOGIN,
          language: defaultEmailSettings.language,
          variables: {
            ...getNotificationUserFields(user),
            name: user.firstName,
            loginDate: new Date().toISOString(),
            courses_url: `${baseOrigin}/courses`,
          },
        },
      },
    );
  }

  async notifyUserAboutCourseAssignment(event: UsersAssignedToCourseEvent) {
    const { usersAssignedToCourse } = event;
    const { courseId, studentIds } = usersAssignedToCourse;

    if (!studentIds.length) return;

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

        return await this.notificationCollectorService.captureNotificationRecipient(
          { to: email },
          {
            tenantId: student.tenantId,
            template: {
              event: EMAIL_TEMPLATE_EVENTS.USER_ASSIGNED_TO_COURSE,
              language: defaultEmailSettings.language,
              variables: {
                ...getNotificationUserFields(student),
                course_name: courseName,
                course_link: `${baseOrigin}/course/${courseId}`,
                formatted_course_due_date: dueDatesByStudent[studentId] ?? "",
              },
            },
          },
        );
      },
      { batchSize: EMAIL_BATCH_SIZE, throwOnError: true },
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

        return this.notificationCollectorService.captureNotificationRecipient(
          { to: user.email },
          {
            tenantId: student.tenantId,
            template: {
              event: EMAIL_TEMPLATE_EVENTS.USER_SHORT_INACTIVITY,
              language: defaultEmailSettings.language,
              variables: {
                ...getNotificationUserFields(student),
                course_name: courseName ?? "",
                course_link: courseLink,
              },
            },
          },
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

        return this.notificationCollectorService.captureNotificationRecipient(
          { to: user.email },
          {
            tenantId: student.tenantId,
            template: {
              event: EMAIL_TEMPLATE_EVENTS.USER_LONG_INACTIVITY,
              language: defaultEmailSettings.language,
              variables: {
                ...getNotificationUserFields(student),
                course_name: course?.courseName ?? "",
                course_link: courseLink,
              },
            },
          },
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

    await this.notificationCollectorService.captureNotificationRecipient(
      { to: user.email },
      {
        tenantId: chapterFinishedData.actor.tenantId,
        template: {
          event: EMAIL_TEMPLATE_EVENTS.USER_FINISHED_CHAPTER,
          language: defaultEmailSettings.language,
          variables: {
            ...getNotificationUserFields(user),
            course_name: courseName,
            chapter_name: chapterName,
            course_link: courseLink,
          },
        },
      },
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

    await this.notificationCollectorService.captureNotificationRecipient(
      { to: user.email },
      {
        tenantId: courseFinishedData.actor.tenantId,
        template: {
          event: EMAIL_TEMPLATE_EVENTS.USER_FINISHED_COURSE,
          language: defaultEmailSettings.language,
          variables: {
            ...getNotificationUserFields(user),
            course_name: courseName,
            button_link: buttonLink,
            course_link: `${baseOrigin}/course/${courseFinishedData.courseId}`,
            has_certificate: hasCertificate,
          },
        },
      },
    );
  }

  private async getRecentCourses(users: InactiveUsers["users"]) {
    return this.statisticsService.getRecentCoursesForStudents(users.map((user) => user.userId));
  }
}
