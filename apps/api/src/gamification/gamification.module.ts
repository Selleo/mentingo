import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { QueueModule } from "src/queue";

import { GamificationEventsHandler } from "./gamification-events.handler";
import { GamificationQueueService } from "./gamification-queue.service";
import { GamificationSetupService } from "./gamification-setup.service";
import { GamificationController } from "./gamification.controller";
import { GamificationRepository } from "./gamification.repository";
import { GamificationService } from "./gamification.service";

@Module({
  imports: [LocalizationModule, PermissionsModule, QueueModule],
  controllers: [GamificationController],
  providers: [
    GamificationRepository,
    GamificationService,
    GamificationQueueService,
    GamificationSetupService,
    GamificationEventsHandler,
  ],
  exports: [GamificationSetupService],
})
export class GamificationModule {}
