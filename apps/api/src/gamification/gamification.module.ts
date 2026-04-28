import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { PermissionsModule } from "src/permissions/permissions.module";

import { UserChapterFinishedPointsHandler } from "./handlers/user-chapter-finished-points.handler";
import { PointsService } from "./points.service";

@Module({
  imports: [CqrsModule, PermissionsModule],
  providers: [PointsService, UserChapterFinishedPointsHandler],
  exports: [PointsService],
})
export class GamificationModule {}
