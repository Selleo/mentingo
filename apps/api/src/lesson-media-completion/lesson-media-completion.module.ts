import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { LessonMediaCompletionService } from "./lesson-media-completion.service";
import { LessonMediaCompletionRepository } from "./repositories/lesson-media-completion.repository";

@Module({
  imports: [FileModule, LocalizationModule, StudentLessonProgressModule],
  providers: [LessonMediaCompletionService, LessonMediaCompletionRepository],
  exports: [LessonMediaCompletionService],
})
export class LessonMediaCompletionModule {}
