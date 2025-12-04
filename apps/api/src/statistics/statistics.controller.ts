import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { SupportedLanguages } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, UUIDType, BaseResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { USER_ROLES, UserRole } from "src/user/schemas/userRoles";

import { UserStatsSchema, StatsSchema } from "./schemas/userStats.schema";
import { StatisticsService } from "./statistics.service";

import type { UserStats, Stats } from "./schemas/userStats.schema";

@UseGuards(RolesGuard)
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
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
