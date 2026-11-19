import { Inject, Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
  SUPPORTED_LANGUAGES,
  TENANT_USER_CAPACITY_ALERT_LEVELS,
} from "@repo/shared";
import { mapValues } from "lodash";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { UserNotificationsCreatedEvent } from "src/events/announcement/user-notifications-created.event";
import { TenantUserCapacityAlertRaisedEvent } from "src/events/tenant/tenant-user-capacity-alert-raised.event";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { UserLimitRepository } from "src/user/repositories/user-limit.repository";
import { getTenantUserCapacityAlertTexts } from "src/user/tenant-user-capacity-alert.localizations";
import { ADMIN_USERS_PAGE_PATH } from "src/user/user.constants";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { TenantUserCapacityAlertRaisedData } from "src/events/tenant/tenant-user-capacity-alert-raised.event";
import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";
import type {
  TenantUserCapacity,
  TenantUserCapacityAlertRecipient,
  TenantUserCapacityAlertTexts,
} from "src/user/types/tenant-user-limit.types";

@Injectable()
@OutboxEventsHandler(TenantUserCapacityAlertRaisedEvent)
export class TenantUserCapacityAlertHandler
  implements OutboxEventsHandlerOf<TenantUserCapacityAlertRaisedEvent>
{
  constructor(
    private readonly userLimitRepository: UserLimitRepository,
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly emailService: EmailService,
    private readonly notificationCollectorService: NotificationCollectorService,
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async handleOutboxEvent(
    event: TenantUserCapacityAlertRaisedEvent,
    { eventId }: OutboxDeliveryContext,
  ) {
    await this.notificationCollectorService.publishCollectedNotifications(eventId, () =>
      this.notifyTenantAdminsAboutUserCapacity(event.tenantUserCapacityAlertRaisedData),
    );
  }

  private async notifyTenantAdminsAboutUserCapacity({
    tenantId,
    alertLevel,
    ...tenantUserCapacity
  }: TenantUserCapacityAlertRaisedData) {
    if (alertLevel === TENANT_USER_CAPACITY_ALERT_LEVELS.WITHIN_LIMIT) return;

    const admins = await this.userLimitRepository.findUserCapacityAlertRecipients(
      tenantId,
      this.db,
    );

    if (!admins.length) return;

    const alertTexts = getTenantUserCapacityAlertTexts(alertLevel, tenantUserCapacity);

    await this.createUserCapacityAnnouncement(alertTexts, admins);
    await this.captureUserCapacityEmails(tenantId, alertTexts, tenantUserCapacity, admins);
  }

  /** The alert has no human author, so the tenant's oldest admin is recorded as one. */
  private async createUserCapacityAnnouncement(
    alertTexts: Record<SupportedLanguages, TenantUserCapacityAlertTexts>,
    admins: TenantUserCapacityAlertRecipient[],
  ) {
    const [oldestAdmin] = admins;
    const adminIds = admins.map(({ id }) => id);

    await this.announcementsRepository.createAnnouncement({
      groupId: null,
      title: mapValues(alertTexts, ({ title }) => title),
      content: mapValues(alertTexts, ({ message }) => message),
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: Object.values(SUPPORTED_LANGUAGES),
      authorId: oldestAdmin.id,
      status: ANNOUNCEMENT_STATUSES.PUBLISHED,
      scheduledAt: null,
      publishedAt: new Date().toISOString(),
      sendEmail: false,
      emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
      sourceType: ANNOUNCEMENT_SOURCE_TYPES.TENANT_USER_CAPACITY,
      sourceId: null,
      linkPath: ADMIN_USERS_PAGE_PATH,
      usersToNotify: adminIds,
    });

    await this.outboxPublisher.publish(new UserNotificationsCreatedEvent({ userIds: adminIds }));
  }

  private async captureUserCapacityEmails(
    tenantId: UUIDType,
    alertTexts: Record<SupportedLanguages, TenantUserCapacityAlertTexts>,
    { activeUsersCount, maxUsers, allowedUsersCount }: TenantUserCapacity,
    admins: TenantUserCapacityAlertRecipient[],
  ) {
    const tenantOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    await processInBatches(
      admins,
      async (admin) => {
        const { language } = await this.emailService.getDefaultEmailProperties(tenantId, admin.id);

        return this.notificationCollectorService.captureNotificationRecipient(
          { to: admin.email },
          {
            tenantId,
            template: {
              event: EMAIL_TEMPLATE_EVENTS.TENANT_USER_CAPACITY,
              language,
              variables: {
                userEmail: admin.email,
                capacity_title: alertTexts[language].title,
                capacity_message: alertTexts[language].message,
                active_users_count: activeUsersCount,
                max_users: maxUsers,
                allowed_users_count: allowedUsersCount,
                users_link: `${tenantOrigin}${ADMIN_USERS_PAGE_PATH}`,
              },
            },
          },
        );
      },
      { batchSize: EMAIL_BATCH_SIZE, throwOnError: true },
    );
  }
}
