import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { S3Module } from "src/s3/s3.module";

import { FileController } from "./file.controller";
import { FileService } from "./file.service";
import { VideoUploadQueueService } from "./video-upload-queue.service";
import { VideoUploadWorker } from "./video-upload.worker";

@Module({
  imports: [S3Module, BunnyStreamModule],
  controllers: [FileController],
  providers: [FileService, VideoUploadQueueService, VideoUploadWorker],
  exports: [FileService],
})
export class FileModule {}
