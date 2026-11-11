import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { QueueModule } from "src/queue";
import { SettingsModule } from "src/settings/settings.module";

import { AchievementAdminController } from "./achievement-admin.controller";
import { AchievementAdminRepository } from "./achievement-admin.repository";
import { AchievementAdminService } from "./achievement-admin.service";
import { GamificationEventsHandler } from "./gamification-events.handler";
import { GamificationQueueService } from "./gamification-queue.service";
import { GamificationSetupService } from "./gamification-setup.service";
import { GamificationController } from "./gamification.controller";
import { GamificationRepository } from "./gamification.repository";
import { GamificationService } from "./gamification.service";
import { LeaderboardController } from "./leaderboard.controller";
import { LeaderboardRepository } from "./leaderboard.repository";
import { LeaderboardService } from "./leaderboard.service";

@Module({
  imports: [FileModule, LocalizationModule, PermissionsModule, QueueModule, SettingsModule],
  controllers: [GamificationController, AchievementAdminController, LeaderboardController],
  providers: [
    AchievementAdminRepository,
    AchievementAdminService,
    GamificationRepository,
    GamificationService,
    GamificationQueueService,
    GamificationSetupService,
    GamificationEventsHandler,
    LeaderboardRepository,
    LeaderboardService,
  ],
  exports: [GamificationSetupService],
})
export class GamificationModule {}
