import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { S3Module } from "src/s3/s3.module";

import { FileController } from "./file.controller";
import { FileService } from "./file.service";
import { ImageVariantService } from "./image-variants/image-variant.service";
import { BunnyVideoProvider } from "./providers/bunny-video.provider";
import { S3VideoProvider } from "./providers/s3-video.provider";
import { ThumbnailService } from "./thumbnail.service";
import { TusUploadService } from "./tus/tus-upload.service";
import { VideoMetadataQueueService } from "./video-metadata.queue.service";
import { VideoMetadataRepository } from "./video-metadata.repository";
import { VideoMetadataService } from "./video-metadata.service";
import { VideoMetadataWorker } from "./video-metadata.worker";
import { VideoProcessingStateService } from "./video-processing-state.service";
import { VideoUploadNotificationGateway } from "./video-upload-notification.gateway";

@Module({
  imports: [S3Module, BunnyStreamModule],
  controllers: [FileController],
  providers: [
    FileService,
    ImageVariantService,
    ThumbnailService,
    BunnyVideoProvider,
    S3VideoProvider,
    TusUploadService,
    VideoProcessingStateService,
    VideoUploadNotificationGateway,
    VideoMetadataQueueService,
    VideoMetadataRepository,
    VideoMetadataService,
    VideoMetadataWorker,
  ],
  exports: [FileService, ImageVariantService, VideoMetadataQueueService],
})
export class FileModule {}
