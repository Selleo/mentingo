import { Module } from "@nestjs/common";

import { CourseDiscussionsController } from "./course-discussions.controller";
import { CourseDiscussionsRepository } from "./course-discussions.repository";
import { CourseDiscussionsService } from "./course-discussions.service";

@Module({
  controllers: [CourseDiscussionsController],
  providers: [CourseDiscussionsRepository, CourseDiscussionsService],
})
export class CourseDiscussionsModule {}
