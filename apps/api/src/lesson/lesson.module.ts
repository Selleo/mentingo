import { forwardRef, Module } from "@nestjs/common";

import { AiModule } from "src/ai/ai.module";
import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { SearchIndexModule } from "src/global-search/search-index.module";
import { IngestionModule } from "src/ingestion/ingestion.module";
import { LessonVideoProgressModule } from "src/lesson-video-progress/lesson-video-progress.module";
import { LiveTrainingModule } from "src/live-training/live-training.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { PermissionsModule } from "src/permissions/permissions.module";
import { QuestionsModule } from "src/questions/question.module";
import { ResourceLibraryModule } from "src/resource-library/resource-library.module";
import { SettingsModule } from "src/settings/settings.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { LessonController } from "./lesson.controller";
import { AdminLessonRepository } from "./repositories/adminLesson.repository";
import { LessonRepository } from "./repositories/lesson.repository";
import { AdminLessonService } from "./services/adminLesson.service";
import { LessonService } from "./services/lesson.service";

@Module({
  imports: [
    FileModule,
    SearchIndexModule,
    QuestionsModule,
    StudentLessonProgressModule,
    AiModule,
    IngestionModule,
    LocalizationModule,
    PermissionsModule,
    ResourceLibraryModule,
    LiveTrainingModule,
    SettingsModule,
    LessonVideoProgressModule,
    forwardRef(() => CourseModule),
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
