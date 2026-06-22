import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import {
  AnnouncementEmail,
  LiveTrainingEndedEmail,
  LiveTrainingReminderEmail,
  LiveTrainingStartedEmail,
} from "@repo/email-templates";
import { ANNOUNCEMENT_EMAIL_TEMPLATES, isSupportedLanguage } from "@repo/shared";

import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { AnnouncementPublishedEvent } from "src/events";
import { DB_ADMIN } from "src/storage/db/db.providers";

import { AnnouncementsRepository } from "../announcements.repository";

import type { AnnouncementEmailTemplate, LocalizedText, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@EventsHandler(AnnouncementPublishedEvent)
export class AnnouncementEmailHandler implements IEventHandler<AnnouncementPublishedEvent> {
  private readonly logger = new Logger(AnnouncementEmailHandler.name);

  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly emailService: EmailService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async handle(event: AnnouncementPublishedEvent) {
    const [announcement] = await this.announcementsRepository.getAnnouncementById(
      event.announcementPublishedData.announcementId,
    );

    if (!announcement?.sendEmail) return;

    const recipients = await this.announcementsRepository.getAnnouncementEmailRecipients(
      announcement.id,
    );
    const tenantOrigin = await resolveTenantOrigin(this.dbAdmin, announcement.tenantId);
    const { language: _defaultLanguage, ...defaultEmailSettings } =
      await this.emailService.getDefaultEmailProperties(announcement.tenantId);

    await processInBatches(
      recipients,
      async (recipient) => {
        const emailLanguage = this.getEmailLanguage(
          announcement.title,
          recipient.language,
          announcement.baseLanguage,
        );
        const title = this.getLocalizedValue(
          announcement.title,
          emailLanguage,
          announcement.baseLanguage,
        );
        const localizedContent = this.getLocalizedValue(
          announcement.content,
          emailLanguage,
          announcement.baseLanguage,
        );
        const content = htmlToPlainText(localizedContent);
        const { text, html } = this.buildEmail({
          title,
          content,
          template: announcement.emailTemplate,
          link: this.getButtonLink(tenantOrigin, announcement.emailTemplate, announcement.sourceId),
          ...defaultEmailSettings,
          language: emailLanguage,
        });

        await this.emailService.sendEmailWithLogo(
          {
            to: recipient.email,
            subject: title,
            text,
            html,
          },
          { tenantId: announcement.tenantId },
        );
      },
      {
        batchSize: EMAIL_BATCH_SIZE,
        throwOnError: false,
        onItemError: (error, recipient) => {
          this.logger.error(`Announcement email failed for recipient ${recipient.id}`, error);
        },
      },
    );
  }

  private getLocalizedValue(
    value: LocalizedText,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ) {
    return value[language] ?? value[baseLanguage] ?? Object.values(value)[0] ?? "";
  }

  private getEmailLanguage(
    value: LocalizedText,
    language: string,
    baseLanguage: SupportedLanguages,
  ): SupportedLanguages {
    if (isSupportedLanguage(language) && value[language]) {
      return language;
    }

    if (value[baseLanguage]) {
      return baseLanguage;
    }

    return Object.keys(value).find(isSupportedLanguage) ?? baseLanguage;
  }

  private buildEmail(input: {
    title: string;
    content: string;
    template: AnnouncementEmailTemplate;
    link: string;
    primaryColor: string;
    companyName: string;
    language: SupportedLanguages;
  }) {
    const commonProps = {
      title: input.title,
      content: input.content,
      primaryColor: input.primaryColor,
      companyName: input.companyName,
      language: input.language,
    };

    switch (input.template) {
      case ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_REMINDER:
        return new LiveTrainingReminderEmail({
          ...commonProps,
          liveTrainingLink: input.link,
        });
      case ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_STARTED:
        return new LiveTrainingStartedEmail({
          ...commonProps,
          liveTrainingLink: input.link,
        });
      case ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_ENDED:
        return new LiveTrainingEndedEmail({
          ...commonProps,
          liveTrainingLink: input.link,
        });
      default:
        return new AnnouncementEmail({
          ...commonProps,
          buttonLink: input.link,
        });
    }
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
