import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import {
  DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS,
  DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS,
  DASHBOARD_DEADLINE_RISK_TYPES,
  DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS,
  PERMISSIONS,
  SupportedLanguages,
  DashboardDeadlineRiskGroupSortField,
  DashboardDeadlineRiskSortDirection,
  DashboardDeadlineRiskUrgencyOrder,
} from "@repo/shared";
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
  DashboardDeadlineRiskCourseSummarySchema,
  DashboardDeadlineRiskGroupSchema,
  DashboardDeadlineRiskSummarySchema,
  DashboardDeadlineRiskType,
  DashboardDeadlineRiskTypeSchema,
  DashboardDeadlineRiskUrgencyOrderSchema,
  DashboardIncompleteCoursesSchema,
  DashboardTrainingCompletionSchema,
  UserStatsSchema,
  StatsSchema,
} from "./schemas/userStats.schema";
import { StatisticsService } from "./statistics.service";

import type {
  DashboardDeadlineRiskCourse,
  DashboardDeadlineRiskCourseSummary,
  DashboardDeadlineRiskGroup,
  DashboardDeadlineRiskSummary,
  DashboardIncompleteCourses,
  DashboardTrainingCompletion,
  UserStats,
  Stats,
} from "./schemas/userStats.schema";
import type { DashboardDeadlineRiskType as SharedDashboardDeadlineRiskType } from "@repo/shared";

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
  @RequirePermission(PERMISSIONS.STATISTICS_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
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
  @RequirePermission(PERMISSIONS.STATISTICS_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
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
  @RequirePermission(PERMISSIONS.STATISTICS_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
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
  @RequirePermission(PERMISSIONS.STATISTICS_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
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

  @Get("dashboard/deadline-risks/courses")
  @RequirePermission(PERMISSIONS.STATISTICS_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({
    request: [
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      {
        type: "query",
        name: "urgencyOrder",
        schema: Type.Optional(DashboardDeadlineRiskUrgencyOrderSchema),
      },
      { type: "query", name: "page", schema: Type.Optional(Type.Integer({ minimum: 1 })) },
      {
        type: "query",
        name: "perPage",
        schema: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      },
    ],
    response: paginatedResponse(Type.Array(DashboardDeadlineRiskCourseSummarySchema)),
  })
  async getDashboardDeadlineRiskCourseSummaries(
    @Query("language") language: SupportedLanguages,
    @Query("urgencyOrder")
    urgencyOrder: DashboardDeadlineRiskUrgencyOrder = DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS.MOST_URGENT,
    @Query("page") page = 1,
    @Query("perPage") perPage = 20,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<DashboardDeadlineRiskCourseSummary[]>> {
    return new PaginatedResponse(
      await this.statisticsService.getDashboardDeadlineRiskCourseSummaries(
        currentUser,
        language,
        urgencyOrder,
        page,
        perPage,
      ),
    );
  }

  @Get("dashboard/deadline-risks/courses/:courseId/groups")
  @RequirePermission(PERMISSIONS.STATISTICS_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: Type.String({ format: "uuid" }) },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      {
        type: "query",
        name: "urgency",
        schema: Type.Optional(Type.Enum(DASHBOARD_DEADLINE_RISK_TYPES)),
      },
      { type: "query", name: "search", schema: Type.Optional(Type.String({ maxLength: 200 })) },
      {
        type: "query",
        name: "sortBy",
        schema: Type.Optional(Type.Enum(DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS)),
      },
      {
        type: "query",
        name: "sortDirection",
        schema: Type.Optional(Type.Enum(DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS)),
      },
      { type: "query", name: "page", schema: Type.Optional(Type.Integer({ minimum: 1 })) },
      {
        type: "query",
        name: "perPage",
        schema: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      },
    ],
    response: paginatedResponse(Type.Array(DashboardDeadlineRiskGroupSchema)),
  })
  async getDashboardDeadlineRiskGroups(
    @Param("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @Query("urgency") urgency: SharedDashboardDeadlineRiskType | undefined,
    @Query("search") search: string | undefined,
    @Query("sortBy")
    sortBy: DashboardDeadlineRiskGroupSortField = DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.DUE_DATE,
    @Query("sortDirection")
    sortDirection: DashboardDeadlineRiskSortDirection = DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS.ASC,
    @Query("page") page = 1,
    @Query("perPage") perPage = 20,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<DashboardDeadlineRiskGroup[]>> {
    return new PaginatedResponse(
      await this.statisticsService.getDashboardDeadlineRiskGroups(
        currentUser,
        courseId,
        language,
        urgency,
        search,
        sortBy,
        sortDirection,
        page,
        perPage,
      ),
    );
  }
}
