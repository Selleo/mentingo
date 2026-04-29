import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { FileModule } from "src/file/files.module";
import { PermissionsModule } from "src/permissions/permissions.module";

import { AchievementsController } from "./achievements.controller";
import { AchievementsRepository } from "./achievements.repository";
import { AchievementsService } from "./achievements.service";
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
  imports: [CqrsModule, FileModule, PermissionsModule],
  controllers: [AchievementsController],
  providers: [
    AchievementsService,
    AchievementsRepository,
    PointsService,
    ...gamificationEventHandlers,
  ],
  exports: [AchievementsService, PointsService],
})
export class GamificationModule {}
