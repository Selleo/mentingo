import { Module } from "@nestjs/common";

import { AiRuntimeModule } from "src/ai/ai-runtime.module";
import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { CourseTransferModule } from "src/course-transfer/course-transfer.module";
import { MasterCourseRepository } from "src/courses/master-course/master-course.repository";
import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { isQueueSandboxProcess } from "src/queue/queue.constants";
import { QueueModule } from "src/queue/queue.module";
import { S3Module } from "src/s3/s3.module";
import { SettingsModule } from "src/settings/settings.module";
import { DbModule } from "src/storage/db/db.module";

import { NativeArchiveController } from "./controllers/native-archive.controller";
import { NativeArchiveWorker } from "./native-archive.worker";
import { NativeArchiveImportRepository } from "./repositories/native-archive-import.repository";
import { NativeArchiveSnapshotRepository } from "./repositories/native-archive-snapshot.repository";
import { NativeArchiveAssetsService } from "./services/native-archive-assets.service";
import { NativeArchiveExportReuseService } from "./services/native-archive-export-reuse.service";
import { NativeArchiveImportService } from "./services/native-archive-import.service";
import { NativeArchiveJobFulfillmentService } from "./services/native-archive-job-fulfillment.service";
import { NativeArchiveJobService } from "./services/native-archive-job.service";
import { NativeArchiveLiveTrainingService } from "./services/native-archive-live-training.service";
import { NativeArchiveSnapshotService } from "./services/native-archive-snapshot.service";
import { NativeArchiveTusService } from "./services/native-archive-tus.service";
import { NativeArchiveValidationService } from "./services/native-archive-validation.service";

@Module({
  imports: [
    AiRuntimeModule,
    CourseTransferModule,
    FileModule,
    BunnyStreamModule,
    LocalizationModule,
    S3Module,
    SettingsModule,
    QueueModule,
    DbModule,
  ],
  controllers: [NativeArchiveController],
  providers: [
    MasterCourseRepository,
    NativeArchiveImportRepository,
    NativeArchiveSnapshotRepository,
    NativeArchiveAssetsService,
    NativeArchiveExportReuseService,
    NativeArchiveImportService,
    NativeArchiveLiveTrainingService,
    NativeArchiveSnapshotService,
    NativeArchiveJobService,
    NativeArchiveJobFulfillmentService,
    NativeArchiveTusService,
    NativeArchiveValidationService,
    ...(isQueueSandboxProcess() ? [] : [NativeArchiveWorker]),
  ],
  exports: [NativeArchiveJobService, NativeArchiveJobFulfillmentService],
})
export class NativeArchiveModule {}
