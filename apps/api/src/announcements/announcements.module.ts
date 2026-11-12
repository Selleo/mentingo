import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { PermissionsModule } from "src/permissions/permissions.module";

import { AnnouncementsDeliveryService } from "./announcements-delivery.service";
import { AnnouncementsSchedulerService } from "./announcements-scheduler.service";
import { AnnouncementsController } from "./announcements.controller";
import { AnnouncementsCron } from "./announcements.cron";
import { AnnouncementsRepository } from "./announcements.repository";
import { AnnouncementsService } from "./announcements.service";

@Module({
  imports: [PermissionsModule, LocalizationModule],
  controllers: [AnnouncementsController],
  providers: [
    AnnouncementsService,
    AnnouncementsRepository,
    AnnouncementsDeliveryService,
    AnnouncementsSchedulerService,
    AnnouncementsCron,
  ],
  exports: [AnnouncementsService, AnnouncementsSchedulerService, AnnouncementsRepository],
})
export class AnnouncementsModule {}
