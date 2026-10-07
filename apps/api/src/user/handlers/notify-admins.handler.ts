import { Injectable, Inject } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { CourseCompletedEvent, UserPasswordCreatedEvent, UserRegisteredEvent } from "src/events";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxNotificationPreparationService } from "src/outbox/outbox-notification-preparation.service";
import { dbAls } from "src/storage/db/db-als.store";
import { DB_ADMIN } from "src/storage/db/db.providers";

import { UserService } from "../user.service";

import type { IEventHandler } from "@nestjs/cqrs";

type EventType = UserRegisteredEvent | UserPasswordCreatedEvent | CourseCompletedEvent;

@Injectable()
export class NotifyAdminsHandler implements IEventHandler<EventType> {
  constructor(
    private userService: UserService,
    private emailService: EmailService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly notificationCollectorService: NotificationCollectorService,
    private readonly outboxNotificationPreparationService: OutboxNotificationPreparationService,
  ) {}

  onModuleInit() {
    this.outboxNotificationPreparationService.register(async (event) => {
      if (
        !(
          event instanceof UserRegisteredEvent ||
          event instanceof UserPasswordCreatedEvent ||
          event instanceof CourseCompletedEvent
        )
      ) {
        return [];
      }

      return this.notificationCollectorService.collectNotificationEvents(() => this.handle(event));
    });
  }

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
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) {
      throw new Error("New user notifications require an originating tenant");
    }

    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    this.notificationCollectorService.captureNotificationItem(user.id, {
      tenantId,
      template: {
        event: EMAIL_TEMPLATE_EVENTS.ADMIN_NEW_USER,
        language: SUPPORTED_LANGUAGES.EN,
        variables: {
          userFirstName: firstName,
          userLastName: lastName,
          userEmail: email,
          registrationDate: user.createdAt,
          user_name: `${firstName} ${lastName}`,
          profile_link: `${origin}/profile/${user.id}`,
        },
      },
    });

    const adminsToNotify = await this.userService.getAdminsToNotifyAboutNewUser(email);

    await processInBatches(
      adminsToNotify,
      async ({ id: adminId, email: adminsEmail, tenantId }) => {
        const baseOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId);

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          tenantId,
          adminId,
        );

        return this.notificationCollectorService.captureNotificationRecipient(
          { to: adminsEmail },
          {
            tenantId,
            template: {
              event: EMAIL_TEMPLATE_EVENTS.ADMIN_NEW_USER,
              language: defaultEmailSettings.language,
              variables: {
                userFirstName: firstName,
                userLastName: lastName,
                userEmail: email,
                registrationDate: user.createdAt,
                user_name: `${firstName} ${lastName}`,
                profile_link: `${baseOrigin}/profile/${user.id}`,
              },
            },
          },
        );
      },
      { batchSize: EMAIL_BATCH_SIZE, throwOnError: true },
    );
  }

  async handleNotifyAdminAboutFinishedCourse(event: CourseCompletedEvent) {
    const {
      courseCompletionData: {
        userName,
        userFirstName,
        userLastName,
        userEmail,
        courseTitle,
        courseId,
      },
    } = event;
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) {
      throw new Error("Course completion notifications require an originating tenant");
    }

    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    this.notificationCollectorService.captureNotificationItem(courseId, {
      tenantId,
      template: {
        event: EMAIL_TEMPLATE_EVENTS.ADMIN_FINISHED_COURSE,
        language: SUPPORTED_LANGUAGES.EN,
        variables: {
          userFirstName,
          userLastName,
          userEmail,
          user_name: userName,
          course_name: courseTitle,
          progress_link: `${origin}/course/${courseId}`,
        },
      },
    });

    const adminsToNotify = await this.userService.getAdminsToNotifyAboutFinishedCourse();

    await processInBatches(
      adminsToNotify,
      async ({ id: adminId, email: adminsEmail, tenantId }) => {
        const baseOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId);

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          tenantId,
          adminId,
        );

        return this.notificationCollectorService.captureNotificationRecipient(
          { to: adminsEmail },
          {
            tenantId,
            template: {
              event: EMAIL_TEMPLATE_EVENTS.ADMIN_FINISHED_COURSE,
              language: defaultEmailSettings.language,
              variables: {
                userFirstName,
                userLastName,
                userEmail,
                user_name: userName,
                course_name: courseTitle,
                progress_link: `${baseOrigin}/course/${courseId}`,
              },
            },
          },
        );
      },
      { batchSize: EMAIL_BATCH_SIZE, throwOnError: false },
    );
  }
}
