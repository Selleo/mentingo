import { Module } from "@nestjs/common";

import { AiModule } from "src/ai/ai.module";
import { FileModule } from "src/file/files.module";
import { IngestionModule } from "src/ingestion/ingestion.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { QuestionsModule } from "src/questions/question.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { LessonController } from "./lesson.controller";
import { AdminLessonRepository } from "./repositories/adminLesson.repository";
import { LessonRepository } from "./repositories/lesson.repository";
import { AdminLessonService } from "./services/adminLesson.service";
import { LessonService } from "./services/lesson.service";

@Module({
  imports: [
    FileModule,
    QuestionsModule,
    StudentLessonProgressModule,
    AiModule,
    IngestionModule,
    LocalizationModule,
  ],
  controllers: [LessonController],
  providers: [
    LessonRepository,
    AdminLessonService,
    AdminLessonRepository,
    LessonService,
    LocalizationService,
  ],
  exports: [AdminLessonService, AdminLessonRepository, LessonRepository, LessonService],
})
export class LessonModule {}
