import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { ChapterModule } from "src/chapter/chapter.module";
import { FileModule } from "src/file/files.module";
import { LessonModule } from "src/lesson/lesson.module";
import { S3Module } from "src/s3/s3.module";

import { ScormRepository } from "./repositories/scorm.repository";
import { ScormController } from "./scorm.controller";
import { ScormService } from "./services/scorm.service";

@Module({
  imports: [S3Module, BunnyStreamModule, FileModule, LessonModule, ChapterModule],
  controllers: [ScormController],
  providers: [ScormService, ScormRepository],
  exports: [ScormService],
})
export class ScormModule {}
