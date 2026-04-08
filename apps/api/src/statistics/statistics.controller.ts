import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, UUIDType, BaseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { UserStatsSchema, StatsSchema } from "./schemas/userStats.schema";
import { StatisticsService } from "./statistics.service";

import type { UserStats, Stats } from "./schemas/userStats.schema";

@UseGuards(PermissionsGuard)
@Controller("statistics")
export class StatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  @Get("user-stats")
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: baseResponse(UserStatsSchema),
  })
  async getUserStatistics(
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<UserStats>> {
    return new BaseResponse(await this.statisticsService.getUserStats(currentUserId, language));
  }

  @Get("stats")
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: baseResponse(StatsSchema),
  })
  async getStats(
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<Stats>> {
    return new BaseResponse(await this.statisticsService.getStats(currentUser, language));
  }
}
