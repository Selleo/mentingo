import { Module } from "@nestjs/common";

import { LessonMediaCompletionModule } from "src/lesson-media-completion/lesson-media-completion.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { LessonVideoProgressController } from "./lesson-video-progress.controller";
import { LessonVideoProgressService } from "./lesson-video-progress.service";
import { LessonVideoWatchSessionService } from "./lesson-video-watch-session.service";
import { LessonVideoProgressRepository } from "./repositories/lesson-video-progress.repository";

@Module({
  imports: [LessonMediaCompletionModule, StudentLessonProgressModule],
  controllers: [LessonVideoProgressController],
  providers: [
    LessonVideoProgressService,
    LessonVideoProgressRepository,
    LessonVideoWatchSessionService,
  ],
  exports: [LessonVideoProgressService, LessonVideoProgressRepository],
})
export class LessonVideoProgressModule {}
