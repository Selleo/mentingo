import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AchievementsModule } from "src/achievements/achievements.module";
import { LocalizationModule } from "src/localization/localization.module";
import { OutboxRepository } from "src/outbox/outbox.repository";
import { SettingsModule } from "src/settings/settings.module";

import { GamificationQueueService } from "./gamification-queue.service";
import { GamificationController } from "./gamification.controller";
import { GamificationHandler } from "./gamification.handler";
import { GamificationRepository } from "./gamification.repository";
import { GamificationService } from "./gamification.service";
import { GamificationWorker } from "./gamification.worker";

@Module({
  exports: [GamificationModule, GamificationQueueService],
  imports: [CqrsModule, SettingsModule, AchievementsModule, LocalizationModule],
  controllers: [GamificationController],
  providers: [
    GamificationService,
    GamificationWorker,
    GamificationQueueService,
    GamificationHandler,
    GamificationRepository,
    OutboxRepository,
  ],
})
export class GamificationModule {}
