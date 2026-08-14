import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  paginatedResponse,
  UUIDType,
  BaseResponse,
  PaginatedResponse,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import {
  DashboardDeadlineRiskCourseSchema,
  DashboardDeadlineRiskSummarySchema,
  DashboardDeadlineRiskType,
  DashboardDeadlineRiskTypeSchema,
  DashboardIncompleteCoursesSchema,
  DashboardTrainingCompletionSchema,
  UserStatsSchema,
  StatsSchema,
} from "./schemas/userStats.schema";
import { StatisticsService } from "./statistics.service";

import type {
  DashboardDeadlineRiskCourse,
  DashboardDeadlineRiskSummary,
  DashboardIncompleteCourses,
  DashboardTrainingCompletion,
  UserStats,
  Stats,
} from "./schemas/userStats.schema";

@UseGuards(PermissionsGuard)
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<Stats>> {
    return new BaseResponse(await this.statisticsService.getStats(currentUser, language));
  }

  @Get("dashboard/training-completion")
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({
    response: baseResponse(DashboardTrainingCompletionSchema),
  })
  async getDashboardTrainingCompletion(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DashboardTrainingCompletion>> {
    return new BaseResponse(
      await this.statisticsService.getDashboardTrainingCompletion(currentUser),
    );
  }

  @Get("dashboard/deadline-risks/summary")
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({
    response: baseResponse(DashboardDeadlineRiskSummarySchema),
  })
  async getDashboardDeadlineRiskSummary(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DashboardDeadlineRiskSummary>> {
    return new BaseResponse(
      await this.statisticsService.getDashboardDeadlineRiskSummary(currentUser),
    );
  }

  @Get("dashboard/incomplete-courses")
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: baseResponse(DashboardIncompleteCoursesSchema),
  })
  async getDashboardIncompleteCourses(
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DashboardIncompleteCourses>> {
    return new BaseResponse(
      await this.statisticsService.getDashboardIncompleteCourses(currentUser, language),
    );
  }

  @Get("dashboard/deadline-risks")
  @RequirePermission(PERMISSIONS.STATISTICS_READ)
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "type", schema: DashboardDeadlineRiskTypeSchema },
      { type: "query", name: "page", schema: Type.Integer({ minimum: 1, default: 1 }) },
      {
        type: "query",
        name: "perPage",
        schema: Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
      },
    ],
    response: paginatedResponse(Type.Array(DashboardDeadlineRiskCourseSchema)),
  })
  async getDashboardDeadlineRisks(
    @Query("language") language: SupportedLanguages,
    @Query("type") riskType: DashboardDeadlineRiskType,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<DashboardDeadlineRiskCourse[]>> {
    return new PaginatedResponse(
      await this.statisticsService.getDashboardDeadlineRisks(
        currentUser,
        language,
        riskType,
        page,
        perPage,
      ),
    );
  }
}
