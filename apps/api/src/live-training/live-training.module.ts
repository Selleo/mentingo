import { Module } from "@nestjs/common";

import { SettingsModule } from "src/settings/settings.module";

import { LiveTrainingController } from "./live-training.controller";
import { LiveTrainingRepository } from "./live-training.repository";
import { LiveTrainingService } from "./live-training.service";

@Module({
  imports: [SettingsModule],
  controllers: [LiveTrainingController],
  providers: [LiveTrainingService, LiveTrainingRepository],
  exports: [LiveTrainingService, LiveTrainingRepository],
})
export class LiveTrainingModule {}
