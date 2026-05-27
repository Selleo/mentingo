import { BadRequestException, Injectable } from "@nestjs/common";
import {
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
  type AnnouncementSourceType,
  type LocalizedText,
} from "@repo/shared";

import { AnnouncementsDeliveryService } from "./announcements-delivery.service";
import { AnnouncementsRepository } from "./announcements.repository";
import {
  ANNOUNCEMENT_SCHEDULE_STEP_MS,
  SCHEDULED_ANNOUNCEMENT_PUBLISH_BATCH_SIZE,
} from "./constants/announcementScheduling.constants";

import type {
  AnnouncementTranslationInput,
  CreateSystemAnnouncementInput,
  ScheduleAnnouncementInput,
} from "./types/announcement-source.types";
import type { CreateAnnouncement } from "./types/announcement.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AnnouncementsSchedulerService {
  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly announcementsDeliveryService: AnnouncementsDeliveryService,
  ) {}

  async createManualAnnouncement(
    createAnnouncementData: CreateAnnouncement,
    author: CurrentUserType,
  ) {
    return this.scheduleAnnouncement({
      groupId: createAnnouncementData.groupId,
      baseLanguage: createAnnouncementData.baseLanguage,
      translations: createAnnouncementData.translations,
      authorId: author.userId,
      scheduledAt: createAnnouncementData.scheduledAt ?? null,
      sendEmail: createAnnouncementData.sendEmail ?? false,
      emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
      sourceType: ANNOUNCEMENT_SOURCE_TYPES.MANUAL,
      sourceId: null,
      rejectPastSchedule: true,
    });
  }

  async createSystemAnnouncement(input: CreateSystemAnnouncementInput) {
    return this.scheduleAnnouncement({
      groupId: null,
      baseLanguage: input.baseLanguage,
      translations: input.translations,
      authorId: input.authorId,
      scheduledAt: input.scheduledAt,
      sendEmail: input.sendEmail,
      emailTemplate: input.emailTemplate,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      rejectPastSchedule: false,
    });
  }

  async updateScheduledSourceAnnouncement(input: CreateSystemAnnouncementInput) {
    if (!input.scheduledAt) return this.publishSourceAnnouncementNow(input);

    const scheduledDate = this.parseScheduledAt(input.scheduledAt);
    const isDue = scheduledDate.getTime() <= Date.now();

    if (isDue) return this.publishSourceAnnouncementNow(input);

    const updatedAnnouncements =
      await this.announcementsRepository.updateScheduledAnnouncementBySource(
        {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
        {
          title: this.getTitleTranslations(input.translations),
          content: this.getContentTranslations(input.translations),
          scheduledAt: input.scheduledAt,
        },
      );

    if (updatedAnnouncements.length) return updatedAnnouncements[0];

    return this.createSystemAnnouncement(input);
  }

  async cancelScheduledSourceAnnouncement(input: {
    sourceType: AnnouncementSourceType;
    sourceId: UUIDType;
  }) {
    await this.announcementsRepository.cancelScheduledAnnouncementBySource(input);
  }

  async publishDueScheduledAnnouncements() {
    const dueAnnouncements = await this.announcementsRepository.claimDueScheduledAnnouncements(
      SCHEDULED_ANNOUNCEMENT_PUBLISH_BATCH_SIZE,
    );

    await this.announcementsDeliveryService.deliverPublishedAnnouncements(
      dueAnnouncements.map((announcement) => announcement.id),
    );

    return dueAnnouncements.length;
  }

  async publishAnnouncementNow(announcementId: UUIDType) {
    const [announcement] =
      await this.announcementsRepository.publishAnnouncementNow(announcementId);

    if (!announcement) return null;

    await this.announcementsDeliveryService.deliverPublishedAnnouncement(announcement.id);

    return announcement;
  }

  private async scheduleAnnouncement(input: ScheduleAnnouncementInput) {
    const scheduledDate = input.scheduledAt ? this.parseScheduledAt(input.scheduledAt) : null;

    if (scheduledDate) {
      this.assertValidScheduledDate(scheduledDate, input.rejectPastSchedule);
    }

    const status = scheduledDate
      ? ANNOUNCEMENT_STATUSES.SCHEDULED
      : ANNOUNCEMENT_STATUSES.PUBLISHED;

    const announcement = await this.announcementsRepository.createAnnouncement({
      groupId: input.groupId,
      title: this.getTitleTranslations(input.translations),
      content: this.getContentTranslations(input.translations),
      baseLanguage: input.baseLanguage,
      availableLocales: input.translations.map((translation) => translation.language),
      authorId: input.authorId,
      sendEmail: input.sendEmail,
      emailTemplate: input.emailTemplate,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status,
      scheduledAt: scheduledDate?.toISOString() ?? null,
      publishedAt: status === ANNOUNCEMENT_STATUSES.PUBLISHED ? new Date().toISOString() : null,
    });

    if (status === ANNOUNCEMENT_STATUSES.PUBLISHED) {
      await this.announcementsDeliveryService.deliverPublishedAnnouncement(announcement.id);
    }

    return announcement;
  }

  private async publishSourceAnnouncementNow(input: CreateSystemAnnouncementInput) {
    await this.cancelScheduledSourceAnnouncement({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });

    const createdAnnouncement = await this.createSystemAnnouncement({
      ...input,
      scheduledAt: null,
    });

    return createdAnnouncement;
  }

  private getTitleTranslations(translations: AnnouncementTranslationInput[]) {
    return Object.fromEntries(
      translations.map((translation) => [translation.language, translation.title]),
    ) as LocalizedText;
  }

  private getContentTranslations(translations: AnnouncementTranslationInput[]) {
    return Object.fromEntries(
      translations.map((translation) => [translation.language, translation.content]),
    ) as LocalizedText;
  }

  private parseScheduledAt(scheduledAt: string) {
    const date = new Date(scheduledAt);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("announcements.toast.invalidSchedule");
    }

    return date;
  }

  private assertValidScheduledDate(date: Date, rejectPastSchedule: boolean) {
    if (date.getTime() % ANNOUNCEMENT_SCHEDULE_STEP_MS !== 0) {
      throw new BadRequestException("announcements.toast.invalidScheduleStep");
    }

    if (rejectPastSchedule && date.getTime() <= Date.now()) {
      throw new BadRequestException("announcements.toast.scheduleInPast");
    }
  }
}
