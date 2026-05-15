import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

import { LiveTrainingController } from "./live-training.controller";
import { LiveTrainingRepository } from "./live-training.repository";
import { LiveTrainingService } from "./live-training.service";

@Module({
  imports: [LocalizationModule, SettingsModule],
  controllers: [LiveTrainingController],
  providers: [LiveTrainingService, LiveTrainingRepository],
  exports: [LiveTrainingService, LiveTrainingRepository],
})
export class LiveTrainingModule {}
