import { Module } from "@nestjs/common";

import { GamificationRepository } from "src/gamification/gamification.repository";
import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

import { AchievementsController } from "./achievements.controller";
import { AchievementsRepository } from "./achievements.repository";
import { AchievementsService } from "./achievements.service";

@Module({
  exports: [AchievementsModule],
  imports: [SettingsModule, LocalizationModule],
  controllers: [AchievementsController],
  providers: [AchievementsService, AchievementsRepository, GamificationRepository],
})
export class AchievementsModule {}
