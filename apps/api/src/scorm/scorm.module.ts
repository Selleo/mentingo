import { Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { LessonModule } from "src/lesson/lesson.module";
import { S3Module } from "src/s3/s3.module";

import { ScormRepository } from "./repositories/scorm.repository";
import { ScormController } from "./scorm.controller";
import { ScormService } from "./scorm.service";

@Module({
  imports: [CourseModule, FileModule, LessonModule, S3Module],
  controllers: [ScormController],
  providers: [ScormService, ScormRepository],
  exports: [ScormService, ScormRepository],
})
export class ScormModule {}
