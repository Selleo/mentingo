import { Module } from "@nestjs/common";

import { NativeArchiveModule } from "src/native-archive/native-archive.module";
import { QueueModule } from "src/queue/queue.module";

import { ContentMarketplaceController } from "./content-marketplace.controller";
import { ContentMarketplaceAnalyticsHandler } from "./handlers/content-marketplace-analytics.handler";
import { ContentMarketplaceLineageRepository } from "./repositories/content-marketplace-lineage.repository";
import { ContentMarketplaceClientService } from "./services/content-marketplace-client.service";
import { ContentMarketplaceEventDeliveryService } from "./services/content-marketplace-event-delivery.service";
import { ContentMarketplaceService } from "./services/content-marketplace.service";

@Module({
  imports: [NativeArchiveModule, QueueModule],
  controllers: [ContentMarketplaceController],
  providers: [
    ContentMarketplaceClientService,
    ContentMarketplaceService,
    ContentMarketplaceEventDeliveryService,
    ContentMarketplaceAnalyticsHandler,
    ContentMarketplaceLineageRepository,
  ],
  exports: [ContentMarketplaceClientService],
})
export class ContentMarketplaceModule {}
