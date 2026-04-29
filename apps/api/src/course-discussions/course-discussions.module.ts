import { Module } from "@nestjs/common";

import {
  CourseDiscussionsController,
  DiscussionCommentsController,
  DiscussionDetailsController,
} from "./course-discussions.controller";
import { CourseDiscussionsRepository } from "./course-discussions.repository";
import { CourseDiscussionsService } from "./course-discussions.service";

@Module({
  controllers: [
    CourseDiscussionsController,
    DiscussionDetailsController,
    DiscussionCommentsController,
  ],
  providers: [CourseDiscussionsRepository, CourseDiscussionsService],
})
export class CourseDiscussionsModule {}
