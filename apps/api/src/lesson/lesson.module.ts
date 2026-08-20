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

import { AiJudgeConfigurationGenerationQueueService } from "./ai-judge-configuration/ai-judge-configuration-generation-queue.service";
import { AiJudgeConfigurationGenerationController } from "./ai-judge-configuration/ai-judge-configuration-generation.controller";
import { AiJudgeConfigurationGenerationService } from "./ai-judge-configuration/ai-judge-configuration-generation.service";
import { AiJudgeConfigurationGenerationWorker } from "./ai-judge-configuration/ai-judge-configuration-generation.worker";
import { AiJudgeConfigurationGraphService } from "./ai-judge-configuration/ai-judge-configuration-graph.service";
import { AiJudgeConfigurationTranslationService } from "./ai-judge-configuration/ai-judge-configuration-translation.service";
import { AiJudgeConfigurationController } from "./ai-judge-configuration/ai-judge-configuration.controller";
import { AiJudgeConfigurationRepository } from "./ai-judge-configuration/ai-judge-configuration.repository";
import { AiJudgeConfigurationService } from "./ai-judge-configuration/ai-judge-configuration.service";
import { AiMentorConfigurationGenerationController } from "./ai-mentor-configuration/controllers/ai-mentor-configuration-generation.controller";
import { AiMentorConfigurationController } from "./ai-mentor-configuration/controllers/ai-mentor-configuration.controller";
import { AiMentorConfigurationGenerationQueueService } from "./ai-mentor-configuration/generation/ai-mentor-configuration-generation-queue.service";
import { AiMentorConfigurationGenerationService } from "./ai-mentor-configuration/generation/ai-mentor-configuration-generation.service";
import { AiMentorConfigurationGenerationWorker } from "./ai-mentor-configuration/generation/ai-mentor-configuration-generation.worker";
import { AiMentorConfigurationRepository } from "./ai-mentor-configuration/repositories/ai-mentor-configuration.repository";
import { AiMentorConfigurationGraphService } from "./ai-mentor-configuration/services/ai-mentor-configuration-graph.service";
import { AiMentorConfigurationService } from "./ai-mentor-configuration/services/ai-mentor-configuration.service";
import { AiMentorLessonTranslationService } from "./ai-mentor-configuration/services/ai-mentor-lesson-translation.service";
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
  controllers: [
    LessonController,
    AiJudgeConfigurationController,
    AiJudgeConfigurationGenerationController,
    AiMentorConfigurationController,
    AiMentorConfigurationGenerationController,
  ],
  providers: [
    AiJudgeConfigurationRepository,
    AiJudgeConfigurationGenerationQueueService,
    AiJudgeConfigurationGenerationService,
    AiJudgeConfigurationGenerationWorker,
    AiJudgeConfigurationGraphService,
    AiJudgeConfigurationService,
    AiJudgeConfigurationTranslationService,
    AiMentorConfigurationRepository,
    AiMentorConfigurationGenerationQueueService,
    AiMentorConfigurationGenerationService,
    AiMentorConfigurationGenerationWorker,
    AiMentorConfigurationGraphService,
    AiMentorConfigurationService,
    AiMentorLessonTranslationService,
    LessonRepository,
    AdminLessonService,
    AdminLessonRepository,
    LessonService,
    LocalizationService,
  ],
  exports: [
    AiJudgeConfigurationGraphService,
    AiJudgeConfigurationTranslationService,
    AiMentorConfigurationGraphService,
    AiMentorLessonTranslationService,
    AdminLessonService,
    AdminLessonRepository,
    LessonRepository,
    LessonService,
  ],
})
export class LessonModule {}
