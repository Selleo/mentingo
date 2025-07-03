import { Controller, Get, UseGuards } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { baseResponse, UUIDType, BaseResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { UserStatsSchema, ContentCreatorStatsSchema } from "./schemas/userStats.schema";
import { StatisticsService } from "./statistics.service";

import type { UserStats, ContentCreatorStats } from "./schemas/userStats.schema";

@UseGuards(RolesGuard)
@Controller("statistics")
export class StatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  @Get("user-stats")
  @Validate({
    response: baseResponse(UserStatsSchema),
  })
  async getUserStatistics(
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<UserStats>> {
    return new BaseResponse(await this.statisticsService.getUserStats(currentUserId));
  }

  @Get("content-creator-stats")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    response: baseResponse(ContentCreatorStatsSchema),
  })
  async getContentCreatorStats(
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<ContentCreatorStats>> {
    return new BaseResponse(await this.statisticsService.getContentCreatorStats(currentUserId));
  }
}
