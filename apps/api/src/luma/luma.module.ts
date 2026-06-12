import { Module } from "@nestjs/common";

import { ChapterModule } from "src/chapter/chapter.module";
import { FileModule } from "src/file/files.module";
import { IngestionModule } from "src/ingestion/ingestion.module";
import { LessonModule } from "src/lesson/lesson.module";
import { LocalizationModule } from "src/localization/localization.module";
import { QueueModule } from "src/queue";
import { WebSocketModule } from "src/websocket";

import { LumaCourseGenerationSyncQueueService } from "./luma-course-generation-sync-queue.service";
import { LumaCourseGenerationSyncRepository } from "./luma-course-generation-sync.repository";
import { LumaCourseGenerationSyncService } from "./luma-course-generation-sync.service";
import { LumaCourseGenerationSyncWorker } from "./luma-course-generation-sync.worker";
import { LumaGeneratedCourseImportService } from "./luma-generated-course-import.service";
import { LumaController } from "./luma.controller";
import { LumaService } from "./luma.service";

@Module({
  imports: [
    ChapterModule,
    FileModule,
    IngestionModule,
    LessonModule,
    LocalizationModule,
    WebSocketModule,
    QueueModule,
  ],
  providers: [
    LumaService,
    LumaCourseGenerationSyncRepository,
    LumaCourseGenerationSyncQueueService,
    LumaCourseGenerationSyncService,
    LumaCourseGenerationSyncWorker,
    LumaGeneratedCourseImportService,
  ],
  controllers: [LumaController],
  exports: [LumaService, LumaCourseGenerationSyncRepository, LumaCourseGenerationSyncService],
})
export class LumaModule {}
