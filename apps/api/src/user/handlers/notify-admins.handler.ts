import { EventsHandler } from "@nestjs/cqrs";
import { FinishedCourseEmail, NewUserEmail } from "@repo/email-templates";

import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { CourseCompletedEvent, UserPasswordCreatedEvent, UserRegisteredEvent } from "src/events";

import { UserService } from "../user.service";

import type { IEventHandler } from "@nestjs/cqrs";

type EventType = UserRegisteredEvent | UserPasswordCreatedEvent | CourseCompletedEvent;

const AdminNotificationEvents = [
  UserRegisteredEvent,
  UserPasswordCreatedEvent,
  CourseCompletedEvent,
] as const;

@EventsHandler(...AdminNotificationEvents)
export class NotifyAdminsHandler implements IEventHandler<EventType> {
  constructor(
    private userService: UserService,
    private emailService: EmailService,
  ) {}

  async handle(event: EventType) {
    if (event instanceof UserRegisteredEvent || event instanceof UserPasswordCreatedEvent) {
      await this.handleNotifyAdminAboutNewUser(event);
    }

    if (event instanceof CourseCompletedEvent) {
      await this.handleNotifyAdminAboutFinishedCourse(event);
    }
  }

  async handleNotifyAdminAboutNewUser(event: UserRegisteredEvent | UserPasswordCreatedEvent) {
    const { user } = event;
    const { firstName, lastName, email } = user;

    const adminsToNotify = await this.userService.getAdminsToNotifyAboutNewUser(email);

    await Promise.all(
      adminsToNotify.map(async ({ id: adminId, email: adminsEmail }) => {
        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(adminId);

        const { text, html } = new NewUserEmail({
          userName: `${firstName} ${lastName}`,
          profileLink: `${process.env.CORS_ORIGIN}/profile/${user.id}`,
          ...defaultEmailSettings,
        });

        return this.emailService.sendEmailWithLogo({
          to: adminsEmail,
          subject: getEmailSubject("adminNewUserEmail", defaultEmailSettings.language),
          text,
          html,
        });
      }),
    );
  }

  async handleNotifyAdminAboutFinishedCourse(event: CourseCompletedEvent) {
    const {
      courseCompletionData: { userName, courseTitle, courseId },
    } = event;

    const adminsToNotify = await this.userService.getAdminsToNotifyAboutFinishedCourse();

    await Promise.all(
      adminsToNotify.map(async ({ id: adminId, email: adminsEmail }) => {
        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(adminId);

        const { text, html } = new FinishedCourseEmail({
          userName,
          courseName: courseTitle,
          progressLink: `${process.env.CORS_ORIGIN}/course/${courseId}`,
          ...defaultEmailSettings,
        });

        return this.emailService.sendEmailWithLogo({
          to: adminsEmail,
          subject: getEmailSubject("adminCourseFinishedEmail", defaultEmailSettings.language),
          text,
          html,
        });
      }),
    );
  }
}
