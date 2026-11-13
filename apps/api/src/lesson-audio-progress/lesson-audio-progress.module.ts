import { Module } from "@nestjs/common";

import { LessonMediaCompletionModule } from "src/lesson-media-completion/lesson-media-completion.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { LessonAudioListenSessionService } from "./lesson-audio-listen-session.service";
import { LessonAudioProgressController } from "./lesson-audio-progress.controller";
import { LessonAudioProgressService } from "./lesson-audio-progress.service";
import { LessonAudioProgressRepository } from "./repositories/lesson-audio-progress.repository";

@Module({
  imports: [LessonMediaCompletionModule, StudentLessonProgressModule],
  controllers: [LessonAudioProgressController],
  providers: [
    LessonAudioProgressService,
    LessonAudioProgressRepository,
    LessonAudioListenSessionService,
  ],
  exports: [LessonAudioProgressService],
})
export class LessonAudioProgressModule {}
