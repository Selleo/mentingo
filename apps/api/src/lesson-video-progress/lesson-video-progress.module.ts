import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { LessonVideoProgressController } from "./lesson-video-progress.controller";
import { LessonVideoProgressService } from "./lesson-video-progress.service";
import { LessonVideoWatchSessionService } from "./lesson-video-watch-session.service";
import { LessonVideoProgressRepository } from "./repositories/lesson-video-progress.repository";

@Module({
  imports: [FileModule, LocalizationModule, StudentLessonProgressModule],
  controllers: [LessonVideoProgressController],
  providers: [
    LessonVideoProgressService,
    LessonVideoProgressRepository,
    LessonVideoWatchSessionService,
  ],
  exports: [LessonVideoProgressService, LessonVideoProgressRepository],
})
export class LessonVideoProgressModule {}
