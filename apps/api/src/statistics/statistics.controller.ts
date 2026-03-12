import { Controller, Get, Query } from "@nestjs/common";
import { SupportedLanguages } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, UUIDType, BaseResponse } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { PERMISSIONS } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";
import { UserRole } from "src/user/schemas/userRoles";

import { UserStatsSchema, StatsSchema } from "./schemas/userStats.schema";
import { StatisticsService } from "./statistics.service";

import type { UserStats, Stats } from "./schemas/userStats.schema";

@Controller("statistics")
export class StatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  @Get("user-stats")
  @RequirePermission(PERMISSIONS.STATISTICS_READ_SELF)
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
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("role") userRole: UserRole,
  ): Promise<BaseResponse<Stats>> {
    return new BaseResponse(
      await this.statisticsService.getStats(currentUserId, userRole, language),
    );
  }
}
