import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { AnnouncementsRepository } from "./announcements.repository";

import type { CreateAnnouncement } from "./types/announcement.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AnnouncementsService {
  constructor(private readonly announcementsRepository: AnnouncementsRepository) {}

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

  async getAnnouncementById(id: string) {
    const [announcement] = await this.announcementsRepository.getAnnouncementById(id);

    if (!announcement) {
      throw new NotFoundException("announcements.error.notFound");
    }

    return announcement;
  }

  async markAnnouncementAsRead(announcementId: UUIDType, userId: UUIDType) {
    const [readAnnouncements] = await this.announcementsRepository.markAnnouncementAsRead(
      announcementId,
      userId,
    );

    if (!readAnnouncements) {
      throw new BadRequestException("announcements.error.markAsReadFailed");
    }

    return readAnnouncements;
  }

  async getAnnouncementsForUser(userId: UUIDType) {
    return await this.announcementsRepository.getAnnouncementsForUser(userId);
  }

  async createAnnouncement(createAnnouncementData: CreateAnnouncement, authorId: UUIDType) {
    if (createAnnouncementData.target.type === "group" && !createAnnouncementData.target.groupId) {
      throw new BadRequestException("announcements.error.groupIdRequired");
    }

    const createAnnouncement = await this.announcementsRepository.createAnnouncement(
      createAnnouncementData,
      authorId,
    );

    if (!createAnnouncement) {
      throw new BadRequestException("announcements.error.createFailed");
    }

    return createAnnouncement;
  }
}
