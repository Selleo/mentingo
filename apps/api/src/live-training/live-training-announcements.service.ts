import { Injectable } from "@nestjs/common";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  SUPPORTED_LANGUAGES,
  type AnnouncementEmailTemplate,
  type LocalizedText,
  type SupportedLanguages,
} from "@repo/shared";

import { AnnouncementsSchedulerService } from "src/announcements/announcements-scheduler.service";

import {
  LIVE_TRAINING_ANNOUNCEMENT_TITLES,
  LIVE_TRAINING_REMINDER_OFFSET_MINUTES,
} from "./live-training-announcements.constants";
import { LiveTrainingRepository } from "./live-training.repository";

import type {
  BuildLiveTrainingAnnouncementInput,
  LiveTrainingNotificationRow,
} from "./live-training-announcements.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class LiveTrainingAnnouncementsService {
  constructor(
    private readonly liveTrainingRepository: LiveTrainingRepository,
    private readonly announcementsSchedulerService: AnnouncementsSchedulerService,
  ) {}

  async syncStartsSoonReminder(liveTrainingId: UUIDType, actor: CurrentUserType) {
    const liveTraining =
      await this.liveTrainingRepository.getLiveTrainingNotificationRow(liveTrainingId);

    if (!liveTraining) return;

    const startsAt = new Date(liveTraining.startsAt);

    if (startsAt.getTime() <= Date.now()) {
      await this.cancelStartsSoonReminder(liveTrainingId);
      return;
    }

    const scheduledAt = new Date(startsAt);
    scheduledAt.setMinutes(scheduledAt.getMinutes() - LIVE_TRAINING_REMINDER_OFFSET_MINUTES);

    await this.announcementsSchedulerService.updateScheduledSourceAnnouncement({
      ...this.buildAnnouncementInput({
        liveTraining,
        actor,
        emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_REMINDER,
      }),
      scheduledAt: scheduledAt.getTime() <= Date.now() ? null : scheduledAt.toISOString(),
    });
  }

  async cancelStartsSoonReminder(liveTrainingId: UUIDType) {
    await this.announcementsSchedulerService.cancelScheduledSourceAnnouncement({
      sourceType: ANNOUNCEMENT_SOURCE_TYPES.LIVE_TRAINING,
      sourceId: liveTrainingId,
    });
  }

  async publishStartedNotification(liveTrainingId: UUIDType, actor: CurrentUserType) {
    await this.publishImmediateNotification(
      liveTrainingId,
      actor,
      ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_STARTED,
    );
  }

  async publishEndedNotification(liveTrainingId: UUIDType, actor: CurrentUserType) {
    await this.publishImmediateNotification(
      liveTrainingId,
      actor,
      ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_ENDED,
    );
  }

  private async publishImmediateNotification(
    liveTrainingId: UUIDType,
    actor: CurrentUserType,
    emailTemplate: AnnouncementEmailTemplate,
  ) {
    const liveTraining =
      await this.liveTrainingRepository.getLiveTrainingNotificationRow(liveTrainingId);

    if (!liveTraining) return;

    await this.announcementsSchedulerService.createSystemAnnouncement({
      ...this.buildAnnouncementInput({ liveTraining, actor, emailTemplate }),
      scheduledAt: null,
    });
  }

  private buildAnnouncementInput(input: BuildLiveTrainingAnnouncementInput) {
    return {
      translations: this.buildTranslations(input.liveTraining, input.emailTemplate),
      baseLanguage: input.liveTraining.baseLanguage as SupportedLanguages,
      authorId: input.actor.userId,
      sendEmail: true,
      emailTemplate: input.emailTemplate,
      sourceType: ANNOUNCEMENT_SOURCE_TYPES.LIVE_TRAINING,
      sourceId: input.liveTraining.id,
    };
  }

  private buildTranslations(
    liveTraining: LiveTrainingNotificationRow,
    emailTemplate: AnnouncementEmailTemplate,
  ) {
    return liveTraining.availableLocales.map((language) => ({
      language,
      title: this.getTitleForTemplate(emailTemplate, language),
      content: this.getContentForTemplate(liveTraining, emailTemplate, language),
    }));
  }

  private getTitleForTemplate(
    emailTemplate: AnnouncementEmailTemplate,
    language: SupportedLanguages,
  ) {
    return (
      LIVE_TRAINING_ANNOUNCEMENT_TITLES[emailTemplate][language] ??
      LIVE_TRAINING_ANNOUNCEMENT_TITLES[emailTemplate][SUPPORTED_LANGUAGES.EN]
    );
  }

  private getContentForTemplate(
    liveTraining: LiveTrainingNotificationRow,
    emailTemplate: AnnouncementEmailTemplate,
    language: SupportedLanguages,
  ) {
    const title = this.getLocalizedValue(liveTraining.title, language, liveTraining.baseLanguage);
    const formattedStart = new Date(liveTraining.startsAt).toLocaleString(language);

    switch (emailTemplate) {
      case ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_REMINDER:
        return this.translate(language, {
          en: `Training "${title}" starts at ${formattedStart}.`,
          pl: `Szkolenie "${title}" rozpocznie się ${formattedStart}.`,
          de: `Das Training "${title}" beginnt am ${formattedStart}.`,
          lt: `Mokymai "${title}" prasidės ${formattedStart}.`,
          cs: `Školení "${title}" začne ${formattedStart}.`,
        });
      case ANNOUNCEMENT_EMAIL_TEMPLATES.LIVE_TRAINING_STARTED:
        return this.translate(language, {
          en: `Training "${title}" is active now.`,
          pl: `Szkolenie "${title}" jest teraz aktywne.`,
          de: `Das Training "${title}" ist jetzt aktiv.`,
          lt: `Mokymai "${title}" dabar vyksta.`,
          cs: `Školení "${title}" nyní probíhá.`,
        });
      default:
        return this.translate(language, {
          en: `Training "${title}" has ended.`,
          pl: `Szkolenie "${title}" zostało zakończone.`,
          de: `Das Training "${title}" wurde beendet.`,
          lt: `Mokymai "${title}" baigėsi.`,
          cs: `Školení "${title}" skončilo.`,
        });
    }
  }

  private getLocalizedValue(
    value: LocalizedText,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ) {
    return value[language] ?? value[baseLanguage] ?? Object.values(value)[0] ?? "";
  }

  private translate(
    language: SupportedLanguages,
    translations: Record<SupportedLanguages, string>,
  ) {
    return translations[language] ?? translations[SUPPORTED_LANGUAGES.EN];
  }
}
