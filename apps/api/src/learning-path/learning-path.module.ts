import { forwardRef, Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { LocalizationModule } from "src/localization/localization.module";
import { S3Module } from "src/s3/s3.module";
import { SettingsModule } from "src/settings/settings.module";

import { LearningPathCertificateController } from "./controllers/learning-path-certificate.controller";
import { LearningPathCourseController } from "./controllers/learning-path-course.controller";
import { LearningPathEnrollmentController } from "./controllers/learning-path-enrollment.controller";
import { LearningPathExportController } from "./controllers/learning-path-export.controller";
import { LearningPathController } from "./controllers/learning-path.controller";
import { LearningPathCourseSyncHandler } from "./handlers/learning-path-course-sync.handler";
import { LearningPathRepository } from "./learning-path.repository";
import { LearningPathWorker } from "./learning-path.worker";
import { LearningPathCertificateService } from "./services/learning-path-certificate.service";
import { LearningPathCourseSyncService } from "./services/learning-path-course-sync.service";
import { LearningPathExportService } from "./services/learning-path-export.service";
import { LearningPathService } from "./services/learning-path.service";

@Module({
  imports: [forwardRef(() => CourseModule), LocalizationModule, SettingsModule, S3Module],
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
    LearningPathCertificateService,
    LearningPathWorker,
  ],
  exports: [LearningPathService, LearningPathRepository],
})
export class LearningPathModule {}
