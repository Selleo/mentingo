import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { PermissionsModule } from "src/permissions/permissions.module";

import { UserAiMentorLessonPassedPointsHandler } from "./handlers/user-ai-mentor-lesson-passed-points.handler";
import { UserChapterFinishedPointsHandler } from "./handlers/user-chapter-finished-points.handler";
import { UserCourseFinishedPointsHandler } from "./handlers/user-course-finished-points.handler";
import { PointsService } from "./points.service";

const gamificationEventHandlers = [
  UserAiMentorLessonPassedPointsHandler,
  UserChapterFinishedPointsHandler,
  UserCourseFinishedPointsHandler,
];

@Module({
  imports: [CqrsModule, PermissionsModule],
  providers: [PointsService, ...gamificationEventHandlers],
  exports: [PointsService],
})
export class GamificationModule {}
