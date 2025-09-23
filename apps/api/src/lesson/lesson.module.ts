import { Module } from "@nestjs/common";

import { AiModule } from "src/ai/ai.module";
import { FileModule } from "src/file/files.module";
import { IngestionModule } from "src/ingestion/ingestion.module";
import { QuestionsModule } from "src/questions/question.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { LessonController } from "./lesson.controller";
import { AdminLessonRepository } from "./repositories/adminLesson.repository";
import { LessonRepository } from "./repositories/lesson.repository";
import { AdminLessonService } from "./services/adminLesson.service";
import { LessonService } from "./services/lesson.service";

@Module({
  imports: [FileModule, QuestionsModule, StudentLessonProgressModule, AiModule, IngestionModule],
  controllers: [LessonController],
  providers: [LessonRepository, AdminLessonService, AdminLessonRepository, LessonService],
  exports: [AdminLessonService, AdminLessonRepository, LessonRepository, LessonService],
})
export class LessonModule {}
