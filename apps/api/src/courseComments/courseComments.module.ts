import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { PermissionsModule } from "src/permissions/permissions.module";

import { CourseCommentsController } from "./courseComments.controller";
import { CourseCommentsRepository } from "./repositories/courseComments.repository";
import { CourseCommentsService } from "./services/courseComments.service";

@Module({
  imports: [PermissionsModule, FileModule],
  controllers: [CourseCommentsController],
  providers: [CourseCommentsService, CourseCommentsRepository],
  exports: [CourseCommentsService],
})
export class CourseCommentsModule {}
