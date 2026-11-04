import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { LessonModule } from "src/lesson/lesson.module";
import { S3Module } from "src/s3/s3.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";
import { WebSocketModule } from "src/websocket";

import { ScormContentAccessService } from "./content/scorm-content-access.service";
import { ScormContentGrantsService } from "./content/scorm-content-grants.service";
import { ScormContentController } from "./content/scorm-content.controller";
import { ScormContentGuard } from "./content/scorm-content.guard";
import { ScormContentMiddleware } from "./content/scorm-content.middleware";
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
  controllers: [ScormController, ScormContentController],
  providers: [
    ScormService,
    ScormQueueService,
    ScormTusUploadService,
    ScormImportWorker,
    ScormRepository,
    ScormContentAccessService,
    ScormContentGrantsService,
    ScormContentGuard,
  ],
  exports: [ScormService, ScormRepository, ScormTusUploadService],
})
export class ScormModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ScormContentMiddleware).forRoutes("*");
  }
}
