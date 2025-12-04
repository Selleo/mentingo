import { BadRequestException, Injectable } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import { CreateAnnouncementEvent, ViewAnnouncementEvent } from "src/events";

import { AnnouncementsRepository } from "./announcements.repository";

import type { CreateAnnouncement, AnnouncementFilters } from "./types/announcement.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly eventBus: EventBus,
  ) {}

  async getAllAnnouncements() {
    return await this.announcementsRepository.getAllAnnouncements();
  }

  async getLatestUnreadAnnouncements(userId: UUIDType) {
    return await this.announcementsRepository.getLatestUnreadAnnouncements(userId);
  }

  async getUnreadAnnouncementsCount(userId: UUIDType) {
    const [unreadCount] = await this.announcementsRepository.getUnreadAnnouncementsCount(userId);

    return unreadCount;
  }

  async markAnnouncementAsRead(announcementId: UUIDType, userId: UUIDType) {
    const [announcement] = await this.announcementsRepository.getAnnouncementById(announcementId);

    if (!announcement) throw new BadRequestException("Announcement not found");

    const [readAnnouncements] = await this.announcementsRepository.markAnnouncementAsRead(
      announcementId,
      userId,
    );

    if (!readAnnouncements) throw new BadRequestException("announcements.toast.markAsReadFailed");

    const audience = announcement.isEveryone ? "everyone" : "group";

    this.eventBus.publish(
      new ViewAnnouncementEvent({
        announcementId,
        readById: userId,
        context: { audience },
      }),
    );

    return readAnnouncements;
  }

  async getAnnouncementsForUser(userId: UUIDType, filters?: AnnouncementFilters) {
    return await this.announcementsRepository.getAnnouncementsForUser(userId, filters);
  }

  async createAnnouncement(createAnnouncementData: CreateAnnouncement, authorId: UUIDType) {
    const createdAnnouncement = await this.announcementsRepository.createAnnouncement(
      createAnnouncementData,
      authorId,
    );

    if (!createdAnnouncement) throw new BadRequestException("announcements.toast.createFailed");

    this.eventBus.publish(
      new CreateAnnouncementEvent({
        announcementId: createdAnnouncement.id,
        createdById: authorId,
        announcement: createdAnnouncement,
      }),
    );

    return createdAnnouncement;
  }
}
