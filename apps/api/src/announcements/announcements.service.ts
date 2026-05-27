import { BadRequestException, Injectable } from "@nestjs/common";
import {
  SUPPORTED_LANGUAGES,
  type AnnouncementStatus,
  type SupportedLanguages,
} from "@repo/shared";

import { parsePagination } from "src/common/pagination";
import { CreateAnnouncementEvent, ViewAnnouncementEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

import { AnnouncementsSchedulerService } from "./announcements-scheduler.service";
import { AnnouncementsRepository } from "./announcements.repository";
import { ANNOUNCEMENTS_PAGE_SIZE } from "./constants/announcementPagination.constants";

import type { CreateAnnouncement, AnnouncementFilters } from "./types/announcement.types";
import type { AnnouncementPaginationQuery } from "./types/announcementPagination.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly announcementsSchedulerService: AnnouncementsSchedulerService,
  ) {}

  async getAllAnnouncements(
    language?: SupportedLanguages,
    paginationQuery: AnnouncementPaginationQuery = {},
    status?: AnnouncementStatus,
  ) {
    const { page, perPage } = parsePagination(paginationQuery.page, paginationQuery.perPage, {
      perPage: ANNOUNCEMENTS_PAGE_SIZE,
    });

    return await this.announcementsRepository.getAllAnnouncements(
      language,
      {
        page,
        perPage: Math.min(perPage, ANNOUNCEMENTS_PAGE_SIZE),
      },
      status,
    );
  }

  async getUnreadAnnouncementsCount(userId: UUIDType) {
    const [unreadCount] = await this.announcementsRepository.getUnreadAnnouncementsCount(userId);

    return unreadCount;
  }

  async markAnnouncementAsRead(announcementId: UUIDType, currentUser: CurrentUserType) {
    const [announcement] = await this.announcementsRepository.getAnnouncementById(announcementId);

    if (!announcement) throw new BadRequestException("announcements.toast.notFound");

    const [readAnnouncements] = await this.announcementsRepository.markAnnouncementAsRead(
      announcementId,
      currentUser.userId,
    );

    if (!readAnnouncements) throw new BadRequestException("announcements.toast.markAsReadFailed");

    const audience = announcement.isEveryone ? "everyone" : "group";

    await this.outboxPublisher.publish(
      new ViewAnnouncementEvent({
        announcementId,
        actor: currentUser,
        context: { audience },
      }),
    );

    return readAnnouncements;
  }

  async markAllAnnouncementsAsRead(currentUser: CurrentUserType) {
    return await this.announcementsRepository.markAllAnnouncementsAsRead(currentUser.userId);
  }

  async getAnnouncementsForUser(
    userId: UUIDType,
    filters?: AnnouncementFilters,
    language?: SupportedLanguages,
    paginationQuery: AnnouncementPaginationQuery = {},
  ) {
    const { page, perPage } = parsePagination(paginationQuery.page, paginationQuery.perPage, {
      perPage: ANNOUNCEMENTS_PAGE_SIZE,
    });

    return await this.announcementsRepository.getAnnouncementsForUser(userId, filters, language, {
      page,
      perPage: Math.min(perPage, ANNOUNCEMENTS_PAGE_SIZE),
    });
  }

  async createAnnouncement(createAnnouncementData: CreateAnnouncement, author: CurrentUserType) {
    this.validateCreateAnnouncement(createAnnouncementData);

    const createdAnnouncement = await this.announcementsSchedulerService.createManualAnnouncement(
      createAnnouncementData,
      author,
    );

    if (!createdAnnouncement) throw new BadRequestException("announcements.toast.createFailed");

    await this.outboxPublisher.publish(
      new CreateAnnouncementEvent({
        announcementId: createdAnnouncement.id,
        actor: author,
        announcement: createdAnnouncement,
      }),
    );

    return createdAnnouncement;
  }

  async deleteAnnouncement(announcementId: UUIDType) {
    const [announcement] = await this.announcementsRepository.getAnnouncementById(announcementId);

    if (!announcement) throw new BadRequestException("announcements.toast.notFound");

    const [deletedAnnouncement] =
      await this.announcementsRepository.deleteAnnouncement(announcementId);

    if (!deletedAnnouncement) throw new BadRequestException("announcements.toast.deleteFailed");
  }

  private validateCreateAnnouncement(createAnnouncementData: CreateAnnouncement) {
    const { baseLanguage, translations } = createAnnouncementData;

    if (!Object.values(SUPPORTED_LANGUAGES).includes(baseLanguage)) {
      throw new BadRequestException("announcements.toast.invalidBaseLanguage");
    }

    if (!translations.length) {
      throw new BadRequestException("announcements.toast.translationsRequired");
    }

    const seenLanguages = new Set<SupportedLanguages>();

    translations.forEach((translation) => {
      if (seenLanguages.has(translation.language)) {
        throw new BadRequestException("announcements.toast.duplicateLanguage");
      }

      seenLanguages.add(translation.language);
    });

    if (!seenLanguages.has(baseLanguage)) {
      throw new BadRequestException("announcements.toast.baseLanguageRequired");
    }
  }
}
