import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { AnnouncementsSchedulerService } from "./announcements-scheduler.service";

@Injectable()
export class AnnouncementsCron {
  constructor(private readonly announcementsSchedulerService: AnnouncementsSchedulerService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async publishDueScheduledAnnouncements() {
    await this.announcementsSchedulerService.publishDueScheduledAnnouncements();
  }
}
