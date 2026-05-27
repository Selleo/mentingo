import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { BaseEmailTemplate } from "@repo/email-templates";
import { ANNOUNCEMENT_EMAIL_TEMPLATES } from "@repo/shared";

import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { processInBatches } from "src/common/utils/processInBatches";
import { AnnouncementPublishedEvent } from "src/events";
import { DB_ADMIN } from "src/storage/db/db.providers";

import { AnnouncementsRepository } from "../announcements.repository";

import type { AnnouncementEmailTemplate, LocalizedText, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

const EMAIL_BATCH_SIZE = 25;

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

    await processInBatches(
      recipients,
      async (recipient) => {
        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          announcement.tenantId,
          recipient.id,
        );
        const title = this.getLocalizedValue(
          announcement.title,
          defaultEmailSettings.language,
          announcement.baseLanguage,
        );
        const content = this.getLocalizedValue(
          announcement.content,
          defaultEmailSettings.language,
          announcement.baseLanguage,
        );
        const tenantOrigin = await resolveTenantOrigin(this.dbAdmin, announcement.tenantId);
        const { text, html } = new BaseEmailTemplate({
          heading: title,
          paragraphs: [content],
          buttonText: this.getButtonText(announcement.emailTemplate, defaultEmailSettings.language),
          buttonLink: this.getButtonLink(
            tenantOrigin,
            announcement.emailTemplate,
            announcement.sourceId,
          ),
          ...defaultEmailSettings,
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

  private getButtonText(template: AnnouncementEmailTemplate, language: SupportedLanguages) {
    const translations = {
      en: {
        default: "Open notifications",
        liveTraining: "Open Live Training",
      },
      pl: {
        default: "Otwórz powiadomienia",
        liveTraining: "Otwórz Live Training",
      },
      de: {
        default: "Benachrichtigungen öffnen",
        liveTraining: "Live Training öffnen",
      },
      lt: {
        default: "Atidaryti pranešimus",
        liveTraining: "Atidaryti Live Training",
      },
      cs: {
        default: "Otevřít oznámení",
        liveTraining: "Otevřít Live Training",
      },
    } satisfies Record<SupportedLanguages, { default: string; liveTraining: string }>;

    const liveTrainingTemplates: AnnouncementEmailTemplate[] = [
      ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_REMINDER,
      ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_STARTED,
      ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_ENDED,
    ];

    return liveTrainingTemplates.includes(template)
      ? translations[language].liveTraining
      : translations[language].default;
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
