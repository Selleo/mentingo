import { Module } from "@nestjs/common";

import { AnnouncementsModule } from "src/announcements/announcements.module";
import { EnvModule } from "src/env/env.module";
import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";
import { WebSocketModule } from "src/websocket";

import { LiveTrainingAnnouncementsHandler } from "./handlers/live-training-announcements.handler";
import { LiveTrainingAnnouncementsService } from "./live-training-announcements.service";
import { LiveTrainingSessionsController } from "./live-training-sessions/live-training-sessions.controller";
import { LiveTrainingSessionsRepository } from "./live-training-sessions/live-training-sessions.repository";
import { LiveTrainingSessionsService } from "./live-training-sessions/live-training-sessions.service";
import { LiveTrainingController } from "./live-training.controller";
import { LiveTrainingRepository } from "./live-training.repository";
import { LiveTrainingService } from "./live-training.service";
import { LiveKitWebhookController } from "./livekit/livekit-webhook.controller";
import { LiveKitService } from "./livekit/livekit.service";

@Module({
  imports: [
    AnnouncementsModule,
    EnvModule,
    FileModule,
    LocalizationModule,
    SettingsModule,
    StudentLessonProgressModule,
    WebSocketModule,
  ],
  controllers: [LiveTrainingController, LiveTrainingSessionsController, LiveKitWebhookController],
  providers: [
    LiveTrainingService,
    LiveTrainingRepository,
    LiveTrainingAnnouncementsService,
    LiveTrainingAnnouncementsHandler,
    LiveTrainingSessionsService,
    LiveTrainingSessionsRepository,
    LiveKitService,
  ],
  exports: [
    LiveTrainingService,
    LiveTrainingRepository,
    LiveTrainingAnnouncementsService,
    LiveTrainingSessionsService,
    LiveTrainingSessionsRepository,
    LiveKitService,
  ],
})
export class LiveTrainingModule {}
