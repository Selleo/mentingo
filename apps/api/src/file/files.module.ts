import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { S3Module } from "src/s3/s3.module";

import { FileController } from "./file.controller";
import { FileService } from "./file.service";
import { BunnyVideoProvider } from "./providers/bunny-video.provider";
import { S3VideoProvider } from "./providers/s3-video.provider";
import { VideoProcessingStateService } from "./video-processing-state.service";
import { VideoUploadNotificationGateway } from "./video-upload-notification.gateway";
import { VideoUploadQueueService } from "./video-upload-queue.service";
import { VideoUploadWorker } from "./video-upload.worker";

import type { RedisConfigSchema } from "src/common/configuration/redis";

@Module({
  imports: [S3Module, BunnyStreamModule],
  controllers: [FileController],
  providers: [
    FileService,
    BunnyVideoProvider,
    S3VideoProvider,
    VideoUploadQueueService,
    VideoUploadWorker,
    VideoProcessingStateService,
    VideoUploadNotificationGateway,
    {
      provide: "REDIS_CONFIG",
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return configService.get("redis") as RedisConfigSchema;
      },
    },
  ],
  exports: [FileService],
})
export class FileModule {}
