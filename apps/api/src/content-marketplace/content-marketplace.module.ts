import { Module } from "@nestjs/common";

import { AnnouncementsModule } from "src/announcements/announcements.module";
import { EmailModule } from "src/common/emails/emails.module";
import { LocalizationModule } from "src/localization/localization.module";
import { NativeArchiveModule } from "src/native-archive/native-archive.module";
import { QueueModule } from "src/queue/queue.module";

import { ContentMarketplaceUpdateCheckCron } from "./content-marketplace-update-check.cron";
import { ContentMarketplaceController } from "./content-marketplace.controller";
import { ContentMarketplaceAnalyticsHandler } from "./handlers/content-marketplace-analytics.handler";
import { ContentMarketplaceCourseUpdatesNotificationHandler } from "./handlers/content-marketplace-course-updates-notification.handler";
import { ContentMarketplaceCourseUpdateRepository } from "./repositories/content-marketplace-course-update.repository";
import { ContentMarketplaceLineageRepository } from "./repositories/content-marketplace-lineage.repository";
import { ContentMarketplaceClientService } from "./services/content-marketplace-client.service";
import { ContentMarketplaceCourseUpdateService } from "./services/content-marketplace-course-update.service";
import { ContentMarketplaceEventDeliveryService } from "./services/content-marketplace-event-delivery.service";
import { ContentMarketplaceUpdateCheckQueueService } from "./services/content-marketplace-update-check-queue.service";
import { ContentMarketplaceService } from "./services/content-marketplace.service";

@Module({
  imports: [NativeArchiveModule, QueueModule, AnnouncementsModule, EmailModule, LocalizationModule],
  controllers: [ContentMarketplaceController],
  providers: [
    ContentMarketplaceClientService,
    ContentMarketplaceService,
    ContentMarketplaceEventDeliveryService,
    ContentMarketplaceAnalyticsHandler,
    ContentMarketplaceLineageRepository,
    ContentMarketplaceCourseUpdateRepository,
    ContentMarketplaceCourseUpdateService,
    ContentMarketplaceUpdateCheckQueueService,
    ContentMarketplaceUpdateCheckCron,
    ContentMarketplaceCourseUpdatesNotificationHandler,
  ],
  exports: [ContentMarketplaceClientService],
})
export class ContentMarketplaceModule {}
