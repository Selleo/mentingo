import { Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";

import { ScormController } from "./scorm.controller";
import { ScormService } from "./scorm.service";

@Module({
  imports: [CourseModule, FileModule],
  controllers: [ScormController],
  providers: [ScormService],
  exports: [ScormService],
})
export class ScormModule {}
