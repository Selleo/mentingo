import { Injectable, Inject } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { UserPasswordCreatedEvent, UserRegisteredEvent } from "src/events";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { dbAls } from "src/storage/db/db-als.store";
import { DB_ADMIN } from "src/storage/db/db.providers";

import { UserService } from "../user.service";

import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type EventType = UserRegisteredEvent | UserPasswordCreatedEvent;

@Injectable()
@OutboxEventsHandler(UserRegisteredEvent, UserPasswordCreatedEvent)
export class NotifyAdminsHandler implements OutboxEventsHandlerOf<EventType> {
  constructor(
    private userService: UserService,
    private emailService: EmailService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly notificationCollectorService: NotificationCollectorService,
  ) {}

  async handleOutboxEvent(event: EventType, { eventId }: OutboxDeliveryContext) {
    await this.notificationCollectorService.publishCollectedNotifications(eventId, () =>
      this.handleNotifyAdminAboutNewUser(event),
    );
  }

  async handleNotifyAdminAboutNewUser(event: EventType) {
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
}
