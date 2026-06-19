import { Inject } from "@nestjs/common";
import { EventsHandler } from "@nestjs/cqrs";
import { FinishedCourseEmail, NewUserEmail } from "@repo/email-templates";

import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { CourseCompletedEvent, UserPasswordCreatedEvent, UserRegisteredEvent } from "src/events";
import { DB_ADMIN } from "src/storage/db/db.providers";

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
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
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

    await processInBatches(
      adminsToNotify,
      async ({ id: adminId, email: adminsEmail, tenantId }) => {
        const baseOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId);

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          tenantId,
          adminId,
        );

        const { text, html } = new NewUserEmail({
          userName: `${firstName} ${lastName}`,
          profileLink: `${baseOrigin}/profile/${user.id}`,
          ...defaultEmailSettings,
        });

        return this.emailService.sendEmailWithLogo(
          {
            to: adminsEmail,
            subject: getEmailSubject("adminNewUserEmail", defaultEmailSettings.language),
            text,
            html,
          },
          { tenantId },
        );
      },
      { batchSize: EMAIL_BATCH_SIZE, throwOnError: false },
    );
  }

  async handleNotifyAdminAboutFinishedCourse(event: CourseCompletedEvent) {
    const {
      courseCompletionData: { userName, courseTitle, courseId },
    } = event;

    const adminsToNotify = await this.userService.getAdminsToNotifyAboutFinishedCourse();

    await processInBatches(
      adminsToNotify,
      async ({ id: adminId, email: adminsEmail, tenantId }) => {
        const baseOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId);

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          tenantId,
          adminId,
        );

        const { text, html } = new FinishedCourseEmail({
          userName,
          courseName: courseTitle,
          progressLink: `${baseOrigin}/course/${courseId}`,
          ...defaultEmailSettings,
        });

        return this.emailService.sendEmailWithLogo(
          {
            to: adminsEmail,
            subject: getEmailSubject("adminCourseFinishedEmail", defaultEmailSettings.language),
            text,
            html,
          },
          { tenantId },
        );
      },
      { batchSize: EMAIL_BATCH_SIZE, throwOnError: false },
    );
  }
}
