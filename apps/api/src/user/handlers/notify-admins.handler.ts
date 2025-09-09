import { EventsHandler } from "@nestjs/cqrs";
import { FinishedCourseEmail, NewUserEmail } from "@repo/email-templates";

import { EmailService } from "src/common/emails/emails.service";
import { CourseCompletedEvent } from "src/events";

import { UserPasswordCreatedEvent } from "../../events/user/user-password-created.event";
import { UserRegisteredEvent } from "../../events/user/user-registered.event";
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

    const { text, html } = new NewUserEmail({
      first_name: firstName,
      last_name: lastName,
      email: email,
    });

    const adminsEmailsToNotify = await this.userService.getAdminsToNotifyAboutNewUser();

    await Promise.all(
      adminsEmailsToNotify.map((adminsEmail) => {
        return this.emailService.sendEmail({
          to: adminsEmail,
          subject: "A new user has registered on your platform",
          text,
          html,
          from: process.env.SES_EMAIL || "",
        });
      }),
    );
  }

  async handleNotifyAdminAboutFinishedCourse(event: CourseCompletedEvent) {
    const {
      courseCompletionData: { userName, courseTitle, groupName, completedAt },
    } = event;

    const { text, html } = new FinishedCourseEmail({
      userName,
      courseName: courseTitle,
      completedAt,
      groupName,
    });

    const adminsEmailsToNotify = await this.userService.getAdminsToNotifyAboutFinishedCourse();

    await Promise.all(
      adminsEmailsToNotify.map((adminsEmail) => {
        return this.emailService.sendEmail({
          to: adminsEmail,
          subject: "A user has completed a course on your platform",
          text,
          html,
          from: process.env.SES_EMAIL || "",
        });
      }),
    );
  }
}
