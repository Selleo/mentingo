import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { CourseDurationModule } from "src/courses/duration/course-duration.module";
import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { isOutboxProcessingEnabled } from "src/outbox/outbox.constants";
import { S3Module } from "src/s3/s3.module";

import { CourseTransferRecoveryCron } from "./course-transfer-recovery.cron";
import { CourseTransferCoordinator } from "./course-transfer.coordinator";
import { CourseTransferDispatcher } from "./course-transfer.dispatcher";
import { CourseTransferVideoMetadataHandler } from "./handlers/course-transfer-video-metadata.handler";
import { CourseTransferGraphRepository } from "./repositories/course-transfer-graph.repository";
import { CourseTransferRelationshipRepository } from "./repositories/course-transfer-relationship.repository";
import { CourseTransferSnapshotRepository } from "./repositories/course-transfer-snapshot.repository";
import { CourseTransferStreamRepository } from "./repositories/course-transfer-stream.repository";
import { CourseTransferAssetService } from "./services/course-transfer-asset.service";
import { CourseTransferMaterializerService } from "./services/course-transfer-materializer.service";
import { CourseTransferRelationshipService } from "./services/course-transfer-relationship.service";
import { CourseTransferSnapshotService } from "./services/course-transfer-snapshot.service";
import { CourseTransferService } from "./services/course-transfer.service";

@Module({
  imports: [BunnyStreamModule, CourseDurationModule, FileModule, LocalizationModule, S3Module],
  providers: [
    CourseTransferStreamRepository,
    CourseTransferRelationshipRepository,
    CourseTransferSnapshotRepository,
    CourseTransferGraphRepository,
    CourseTransferRelationshipService,
    CourseTransferCoordinator,
    CourseTransferDispatcher,
    CourseTransferSnapshotService,
    CourseTransferAssetService,
    CourseTransferMaterializerService,
    CourseTransferService,
    CourseTransferVideoMetadataHandler,
    ...(isOutboxProcessingEnabled() ? [CourseTransferRecoveryCron] : []),
  ],
  exports: [CourseTransferService, CourseTransferSnapshotService, CourseTransferGraphRepository],
})
export class CourseTransferModule {}
