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
import { LeaderboardQueryService } from "./leaderboard-query.service";
import { LeaderboardController } from "./leaderboard.controller";
import { PointsService } from "./points.service";
import { ProfileAchievementsController } from "./profile-achievements.controller";

const gamificationEventHandlers = [
  UserAiMentorLessonPassedPointsHandler,
  UserChapterFinishedPointsHandler,
  UserCourseFinishedPointsHandler,
];

@Module({
  imports: [CqrsModule, FileModule, PermissionsModule],
  controllers: [AchievementsController, ProfileAchievementsController, LeaderboardController],
  providers: [
    AchievementsService,
    AchievementsRepository,
    PointsService,
    LeaderboardQueryService,
    ...gamificationEventHandlers,
  ],
  exports: [AchievementsService, PointsService],
})
export class GamificationModule {}
