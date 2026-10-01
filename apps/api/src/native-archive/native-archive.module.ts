import { Module } from "@nestjs/common";

import { AiModule } from "src/ai/ai.module";
import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { QueueModule } from "src/queue/queue.module";
import { S3Module } from "src/s3/s3.module";
import { SettingsModule } from "src/settings/settings.module";
import { DbModule } from "src/storage/db/db.module";

import { NativeArchiveController } from "./controllers/native-archive.controller";
import { NativeArchiveImportRepository } from "./repositories/native-archive-import.repository";
import { NativeArchiveSnapshotRepository } from "./repositories/native-archive-snapshot.repository";
import { NativeArchiveAssetsService } from "./services/native-archive-assets.service";
import { NativeArchiveImportService } from "./services/native-archive-import.service";
import { NativeArchiveJobService } from "./services/native-archive-job.service";
import { NativeArchiveLiveTrainingService } from "./services/native-archive-live-training.service";
import { NativeArchiveSnapshotService } from "./services/native-archive-snapshot.service";
import { NativeArchiveTusService } from "./services/native-archive-tus.service";
import { NativeArchiveValidationService } from "./services/native-archive-validation.service";

@Module({
  imports: [
    AiModule,
    CourseModule,
    FileModule,
    BunnyStreamModule,
    S3Module,
    SettingsModule,
    QueueModule,
    DbModule,
  ],
  controllers: [NativeArchiveController],
  providers: [
    NativeArchiveImportRepository,
    NativeArchiveSnapshotRepository,
    NativeArchiveAssetsService,
    NativeArchiveImportService,
    NativeArchiveLiveTrainingService,
    NativeArchiveSnapshotService,
    NativeArchiveJobService,
    NativeArchiveTusService,
    NativeArchiveValidationService,
  ],
})
export class NativeArchiveModule {}
