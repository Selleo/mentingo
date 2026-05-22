import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

import { LiveTrainingSessionsController } from "./live-training-sessions/live-training-sessions.controller";
import { LiveTrainingSessionsRepository } from "./live-training-sessions/live-training-sessions.repository";
import { LiveTrainingSessionsService } from "./live-training-sessions/live-training-sessions.service";
import { LiveTrainingController } from "./live-training.controller";
import { LiveTrainingRepository } from "./live-training.repository";
import { LiveTrainingService } from "./live-training.service";

@Module({
  imports: [FileModule, LocalizationModule, SettingsModule],
  controllers: [LiveTrainingController, LiveTrainingSessionsController],
  providers: [
    LiveTrainingService,
    LiveTrainingRepository,
    LiveTrainingSessionsService,
    LiveTrainingSessionsRepository,
  ],
  exports: [
    LiveTrainingService,
    LiveTrainingRepository,
    LiveTrainingSessionsService,
    LiveTrainingSessionsRepository,
  ],
})
export class LiveTrainingModule {}
