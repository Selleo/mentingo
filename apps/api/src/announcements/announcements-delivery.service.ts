import { Injectable } from "@nestjs/common";

import { AnnouncementPublishedEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

import { AnnouncementsRepository } from "./announcements.repository";

import type { UUIDType } from "src/common";

@Injectable()
export class AnnouncementsDeliveryService {
  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async deliverPublishedAnnouncement(announcementId: UUIDType) {
    await this.announcementsRepository.createUserAnnouncementRecordsForAnnouncement(announcementId);
    await this.outboxPublisher.publish(new AnnouncementPublishedEvent({ announcementId }));
  }

  async deliverPublishedAnnouncements(announcementIds: UUIDType[]) {
    await Promise.all(
      announcementIds.map((announcementId) => this.deliverPublishedAnnouncement(announcementId)),
    );
  }
}
