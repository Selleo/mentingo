import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunny-stream.module";
import { S3Module } from "src/s3/s3.module";

import { FileController } from "./file.controller";
import { FileService } from "./file.service";

@Module({
  imports: [S3Module, BunnyStreamModule],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
