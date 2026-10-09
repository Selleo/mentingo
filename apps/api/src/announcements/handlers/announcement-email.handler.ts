import { Injectable, Inject, Logger } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import { ANNOUNCEMENT_EMAIL_TEMPLATES, isSupportedLanguage } from "@repo/shared";

import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { AnnouncementPublishedEvent } from "src/events";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxNotificationPreparationService } from "src/outbox/outbox-notification-preparation.service";
import { DB_ADMIN } from "src/storage/db/db.providers";

import { AnnouncementsRepository } from "../announcements.repository";

import type { IEventHandler } from "@nestjs/cqrs";
import type { AnnouncementEmailTemplate, LocalizedText } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class AnnouncementEmailHandler implements IEventHandler<AnnouncementPublishedEvent> {
  private readonly logger = new Logger(AnnouncementEmailHandler.name);

  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly notificationCollectorService: NotificationCollectorService,
    private readonly outboxNotificationPreparationService: OutboxNotificationPreparationService,
  ) {}

  onModuleInit() {
    this.outboxNotificationPreparationService.register(async (event) => {
      if (!(event instanceof AnnouncementPublishedEvent)) {
        return [];
      }

      return this.notificationCollectorService.collectNotificationEvents(() => this.handle(event));
    });
  }

  async handle(event: AnnouncementPublishedEvent) {
    const [announcement] = await this.announcementsRepository.getAnnouncementById(
      event.announcementPublishedData.announcementId,
    );

    if (!announcement?.sendEmail) return;

    const recipients = await this.announcementsRepository.getAnnouncementEmailRecipients(
      announcement.id,
    );
    const tenantOrigin = await resolveTenantOrigin(this.dbAdmin, announcement.tenantId);
    const localizedContent = await this.announcementsRepository.getAnnouncementEmailContent(
      announcement.id,
    );
    const title: LocalizedText = Object.fromEntries(
      localizedContent.map(({ language, title }) => [language, title]),
    );
    const content: LocalizedText = Object.fromEntries(
      localizedContent.map(({ language, content }) => [language, htmlToPlainText(content)]),
    );
    const buttonLink = this.getButtonLink(
      tenantOrigin,
      announcement.emailTemplate,
      announcement.sourceId,
    );

    this.notificationCollectorService.captureNotificationItem(announcement.id, {
      tenantId: announcement.tenantId,
      template: {
        event:
          announcement.emailTemplate === ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT
            ? EMAIL_TEMPLATE_EVENTS.ANNOUNCEMENT
            : announcement.emailTemplate,
        language: announcement.baseLanguage,
        variables: {
          title,
          content,
          button_link: buttonLink,
          live_training_link: buttonLink,
        },
      },
    });

    await processInBatches(
      recipients,
      async (recipient) => {
        await this.notificationCollectorService.captureNotificationRecipient(
          { to: recipient.email },
          {
            tenantId: announcement.tenantId,
            template: {
              event:
                announcement.emailTemplate === ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT
                  ? EMAIL_TEMPLATE_EVENTS.ANNOUNCEMENT
                  : announcement.emailTemplate,
              language: isSupportedLanguage(recipient.language)
                ? recipient.language
                : announcement.baseLanguage,
              variables: {
                userEmail: recipient.email,
                userFirstName: recipient.firstName,
                userLastName: recipient.lastName,
                title,
                content,
                button_link: buttonLink,
                live_training_link: buttonLink,
              },
            },
          },
        );
      },
      {
        batchSize: EMAIL_BATCH_SIZE,
        throwOnError: true,
        onItemError: (error, recipient) => {
          this.logger.error(`Announcement email failed for recipient ${recipient.id}`, error);
        },
      },
    );
  }

  private getButtonLink(
    tenantOrigin: string,
    template: AnnouncementEmailTemplate,
    sourceId: UUIDType | null,
  ) {
    if (sourceId && template !== ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT) {
      return `${tenantOrigin}/live-training/${sourceId}`;
    }

    return `${tenantOrigin}/notifications`;
  }
}

function htmlToPlainText(value: string) {
  return decodeHtmlEntities(value.replace(/<br\s*\/?>/giu, "\n").replace(/<[^>]*>/gu, ""));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&apos;/gu, "'");
}
