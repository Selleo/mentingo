import { Injectable } from "@nestjs/common";

import { processInBatches } from "src/common/utils/processInBatches";
import { AnnouncementPublishedEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

import { AnnouncementsRepository } from "./announcements.repository";

import type { UUIDType } from "src/common";

const ANNOUNCEMENT_DELIVERY_BATCH_SIZE = 25;

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
    await processInBatches(
      announcementIds,
      (announcementId) => this.deliverPublishedAnnouncement(announcementId),
      { batchSize: ANNOUNCEMENT_DELIVERY_BATCH_SIZE },
    );
  }
}
