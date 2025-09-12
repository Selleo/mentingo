import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { S3Module } from "src/s3/s3.module";

import { CsvXlsxProcessorService } from "./csv-xlsx-processor.service";
import { FileController } from "./file.controller";
import { FileService } from "./file.service";

@Module({
  imports: [S3Module, BunnyStreamModule],
  controllers: [FileController],
  providers: [FileService, CsvXlsxProcessorService],
  exports: [FileService, CsvXlsxProcessorService],
})
export class FileModule {}
