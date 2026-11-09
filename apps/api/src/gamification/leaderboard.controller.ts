import { Controller, Get, Query } from "@nestjs/common";
import {
  FEATURES,
  PERMISSIONS,
  type LeaderboardMetric,
  type LeaderboardPeriod,
  type SupportedLanguages,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequireFeature } from "src/common/decorators/require-feature.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { LeaderboardService } from "./leaderboard.service";
import {
  leaderboardDateSchema,
  leaderboardMetricSchema,
  leaderboardPeriodSchema,
  leaderboardSchema,
  leaderboardScopesSchema,
  type LeaderboardResponse,
  type LeaderboardScopesResponse,
} from "./schemas/leaderboard.schema";

@Controller("gamification/leaderboards")
@RequireFeature({ features: [FEATURES.GAMIFICATION, FEATURES.LEADERBOARDS] })
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /** Scopes the current user may open: the organization-wide leaderboard and groups. */
  @Get("scopes")
  @RequirePermission(PERMISSIONS.GAMIFICATION_LEADERBOARD_READ)
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: baseResponse(leaderboardScopesSchema),
  })
  async getLeaderboardScopes(
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LeaderboardScopesResponse>> {
    return new BaseResponse(await this.leaderboardService.getScopes(currentUser, language));
  }

  /** Organization-wide leaderboard when `groupId` is omitted. */
  @Get()
  @RequirePermission(PERMISSIONS.GAMIFICATION_LEADERBOARD_READ)
  @Validate({
    request: [
      { type: "query", name: "metric", schema: leaderboardMetricSchema },
      { type: "query", name: "period", schema: leaderboardPeriodSchema },
      { type: "query", name: "from", schema: leaderboardDateSchema },
      { type: "query", name: "to", schema: leaderboardDateSchema },
      { type: "query", name: "groupId", schema: Type.Optional(UUIDSchema) },
    ],
    response: baseResponse(leaderboardSchema),
  })
  async getLeaderboard(
    @Query("metric") metric: LeaderboardMetric,
    @Query("period") period: LeaderboardPeriod,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("groupId") groupId: UUIDType | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LeaderboardResponse>> {
    return new BaseResponse(
      await this.leaderboardService.getLeaderboard(
        { metric, period, from, to, groupId },
        currentUser,
      ),
    );
  }
}
