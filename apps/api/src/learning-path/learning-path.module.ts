import { forwardRef, Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { SearchIndexModule } from "src/global-search/search-index.module";
import { LocalizationModule } from "src/localization/localization.module";
import { S3Module } from "src/s3/s3.module";
import { SettingsModule } from "src/settings/settings.module";

import { LearningPathCertificateController } from "./controllers/learning-path-certificate.controller";
import { LearningPathCourseController } from "./controllers/learning-path-course.controller";
import { LearningPathEnrollmentController } from "./controllers/learning-path-enrollment.controller";
import { LearningPathExportController } from "./controllers/learning-path-export.controller";
import { LearningPathController } from "./controllers/learning-path.controller";
import { LearningPathsEnabledGuard } from "./guards/learning-paths-enabled.guard";
import { LearningPathCourseSyncHandler } from "./handlers/learning-path-course-sync.handler";
import { LearningPathQueueService } from "./learning-path.queue.service";
import { LearningPathRepository } from "./learning-path.repository";
import { LearningPathWorker } from "./learning-path.worker";
import { LearningPathCertificateService } from "./services/learning-path-certificate.service";
import { LearningPathCourseSyncService } from "./services/learning-path-course-sync.service";
import { LearningPathExportService } from "./services/learning-path-export.service";
import { LearningPathService } from "./services/learning-path.service";

@Module({
  imports: [
    forwardRef(() => CourseModule),
    FileModule,
    SearchIndexModule,
    LocalizationModule,
    SettingsModule,
    S3Module,
  ],
  controllers: [
    LearningPathController,
    LearningPathCourseController,
    LearningPathEnrollmentController,
    LearningPathExportController,
    LearningPathCertificateController,
  ],
  providers: [
    LearningPathService,
    LearningPathRepository,
    LearningPathCourseSyncService,
    LearningPathCourseSyncHandler,
    LearningPathExportService,
    LearningPathQueueService,
    LearningPathCertificateService,
    LearningPathWorker,
    LearningPathsEnabledGuard,
  ],
  exports: [LearningPathService, LearningPathRepository],
})
export class LearningPathModule {}
