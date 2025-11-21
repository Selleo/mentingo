import { EventsHandler } from "@nestjs/cqrs";
import {
  UserFirstLoginEmail,
  UserAssignedToCourseEmail,
  UserInviteEmail,
  UserShortInactivityEmail,
  UserLongInactivityEmail,
  UserFinishedChapterEmail,
  UserFinishedCourseEmail,
} from "@repo/email-templates";

import { EmailService } from "src/common/emails/emails.service";
import { CourseService } from "src/courses/course.service";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { UserFirstLoginEvent } from "src/events/user/user-first-login.event";
import { UserInviteEvent } from "src/events/user/user-invite.event";
import { UsersLongInactivityEvent } from "src/events/user/user-long-inactivity.event";
import { UsersShortInactivityEvent } from "src/events/user/user-short-inactivity.event";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsService } from "src/statistics/statistics.service";
import { UserService } from "src/user/user.service";

import type { IEventHandler } from "@nestjs/cqrs";
import type { InactiveUsers } from "src/events/user/user-short-inactivity.event";
import type { UserEmailTriggersSchema } from "src/settings/schemas/settings.schema";

type EventType =
  | UserInviteEvent
  | UserFirstLoginEvent
  | UsersAssignedToCourseEvent
  | UsersShortInactivityEvent
  | UsersLongInactivityEvent
  | UserChapterFinishedEvent
  | UserCourseFinishedEvent;

const UserNotificationEvents = [
  UserInviteEvent,
  UserFirstLoginEvent,
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
    private readonly emailService: EmailService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly statisticsService: StatisticsService,
    private readonly settingsService: SettingsService,
  ) {}

  async handle(event: EventType) {
    const { userEmailTriggers } = await this.settingsService.getGlobalSettings();

    if (event instanceof UserInviteEvent) {
      await this.notifyUserAboutInvite(event);
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
    const { email, creatorId, token } = userInvite;

    const url = `${process.env.CORS_ORIGIN}/auth/create-new-password?createToken=${token}&email=${email}`;

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties();
    const { firstName, lastName } = await this.userService.getUserById(creatorId);

    const { text, html } = new UserInviteEmail({
      invitedByUserName: `${firstName} ${lastName}`,
      createPasswordLink: url,
      ...defaultEmailSettings,
    });

    await this.emailService.sendEmailWithLogo({
      to: email,
      subject: "Witaj na platformie!",
      text,
      html,
      from: process.env.SES_EMAIL || "",
    });
  }

  async notifyUserAboutFirstLogin(event: UserFirstLoginEvent) {
    const { userFirstLogin } = event;
    const { userId } = userFirstLogin;

    const user = await this.userService.getUserById(userId);

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties();

    const { text, html } = new UserFirstLoginEmail({
      name: user.firstName,
      coursesUrl: `${process.env.CORS_ORIGIN}/courses`,
      ...defaultEmailSettings,
    });

    await this.emailService.sendEmailWithLogo({
      to: user.email,
      subject: "Pierwsze logowanie!",
      text,
      html,
      from: process.env.SES_EMAIL || "",
    });
  }

  async notifyUserAboutCourseAssignment(event: UsersAssignedToCourseEvent) {
    const { usersAssignedToCourse } = event;
    const { courseId, studentIds } = usersAssignedToCourse;

    const courseLink = `${process.env.CORS_ORIGIN}/course/${courseId}`;
    const courseName = await this.courseService.getCourseName(courseId);

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties();

    const { text, html } = new UserAssignedToCourseEmail({
      courseName,
      courseLink,
      ...defaultEmailSettings,
    });

    const userEmails = await this.userService.getStudentEmailsByIds(studentIds);

    await Promise.all(
      userEmails.map((email) =>
        this.emailService.sendEmailWithLogo({
          to: email,
          subject: `Nowy kurs - ${courseName}`,
          text,
          html,
          from: process.env.SES_EMAIL || "",
        }),
      ),
    );
  }

  async notifyUserAboutShortInactivity(event: UsersShortInactivityEvent) {
    const { usersShortInactivity } = event;
    const { users } = usersShortInactivity;

    const recentCourses = await this.getRecentCourses(users);

    await Promise.all(
      users.map(async (user) => {
        const course = recentCourses.find((course) => course.studentId == user.userId);
        const courseLink = `${process.env.CORS_ORIGIN}/course/${course?.courseId}`;

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties();

        const { text, html } = new UserShortInactivityEmail({
          courseName: course?.courseName ?? "",
          courseLink,
          ...defaultEmailSettings,
        });

        this.emailService.sendEmailWithLogo({
          to: user.email,
          subject: `Kontynuuj kurs - ${course?.courseName}`,
          text,
          html,
          from: process.env.SES_EMAIL || "",
        });
      }),
    );
  }

  async notifyUserAboutLongInactivity(event: UsersLongInactivityEvent) {
    const { usersLongInactivity } = event;
    const { users } = usersLongInactivity;

    const recentCourses = await this.getRecentCourses(users);

    await Promise.all(
      users.map(async (user) => {
        const course = recentCourses.find((course) => course.studentId == user.userId);

        if (!course) return;

        const courseLink = `${process.env.CORS_ORIGIN}/course/${course?.courseId}`;

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties();

        const { text, html } = new UserLongInactivityEmail({
          courseName: course.courseName,
          courseLink,
          ...defaultEmailSettings,
        });

        this.emailService.sendEmailWithLogo({
          to: user.email,
          subject: "Wróć do swoich kursów",
          text,
          html,
          from: process.env.SES_EMAIL || "",
        });
      }),
    );
  }

  async notifyUserAboutChapterFinished(event: UserChapterFinishedEvent) {
    const { chapterFinishedData } = event;

    const user = await this.userService.getUserById(chapterFinishedData.userId);
    const chapterName = await this.courseService.getChapterName(chapterFinishedData.chapterId);
    const courseName = await this.courseService.getCourseName(chapterFinishedData.courseId);

    const courseLink = `${process.env.CORS_ORIGIN}/course/${chapterFinishedData.courseId}`;

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties();

    const { text, html } = new UserFinishedChapterEmail({
      courseName,
      courseLink,
      chapterName,
      ...defaultEmailSettings,
    });

    await this.emailService.sendEmailWithLogo({
      to: user.email,
      subject: `Ukończono moduł - ${chapterName}`,
      html,
      text,
      from: process.env.SES_EMAIL || "",
    });
  }

  async notifyUserAboutCourseCompleted(event: UserCourseFinishedEvent) {
    const { courseFinishedData } = event;

    const user = await this.userService.getUserById(courseFinishedData.userId);
    const courseName = await this.courseService.getCourseName(courseFinishedData.courseId);

    const certificateDownloadLink = `${process.env.CORS_ORIGIN}/profile/${user.id}`;

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties();

    const { text, html } = new UserFinishedCourseEmail({
      certificateDownloadLink,
      courseName,
      ...defaultEmailSettings,
    });

    await this.emailService.sendEmailWithLogo({
      to: user.email,
      subject: `Ukończono kurs - ${courseName}`,
      html,
      text,
      from: process.env.SES_EMAIL || "",
    });
  }

  private async getRecentCourses(users: InactiveUsers["users"]) {
    return this.statisticsService.getRecentCoursesForStudents(users.map((user) => user.userId));
  }
}
