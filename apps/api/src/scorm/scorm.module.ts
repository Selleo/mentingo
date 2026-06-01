import { Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { LessonModule } from "src/lesson/lesson.module";
import { S3Module } from "src/s3/s3.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";
import { WebSocketModule } from "src/websocket";

import { ScormRepository } from "./repositories/scorm.repository";
import { ScormImportWorker } from "./scorm-import.worker";
import { ScormQueueService } from "./scorm-queue.service";
import { ScormTusUploadService } from "./scorm-tus-upload.service";
import { ScormController } from "./scorm.controller";
import { ScormService } from "./scorm.service";

@Module({
  imports: [
    CourseModule,
    FileModule,
    LessonModule,
    S3Module,
    StudentLessonProgressModule,
    WebSocketModule,
  ],
  controllers: [ScormController],
  providers: [
    ScormService,
    ScormQueueService,
    ScormTusUploadService,
    ScormImportWorker,
    ScormRepository,
  ],
  exports: [ScormService, ScormRepository],
})
export class ScormModule {}
