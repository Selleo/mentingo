import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS, REWARD_ACTION_TYPES, RewardActionType } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import {
  UpdateRewardRuleBody,
  UpsertRewardAchievementBody,
  leaderboardSchema,
  rewardAchievementSchema,
  rewardGroupSchema,
  rewardRuleSchema,
  rewardsBackfillSchema,
  rewardsProfileSchema,
  updateRewardRuleSchema,
  upsertRewardAchievementSchema,
} from "src/rewards/rewards.schema";
import { RewardsService } from "src/rewards/rewards.service";

@Controller("rewards")
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get("profile/:userId")
  @RequirePermission(PERMISSIONS.REWARDS_READ)
  @Validate({
    request: [{ type: "param", name: "userId", schema: UUIDSchema }],
    response: baseResponse(rewardsProfileSchema),
  })
  async getProfile(@Param("userId") userId: UUIDType) {
    return new BaseResponse(await this.rewardsService.getProfile(userId));
  }

  @Get("leaderboard")
  @RequirePermission(PERMISSIONS.REWARDS_READ)
  @Validate({
    request: [{ type: "query", name: "groupId", schema: Type.Optional(UUIDSchema) }],
    response: baseResponse(leaderboardSchema),
  })
  async getLeaderboard(
    @Query("groupId") groupId?: UUIDType,
    @CurrentUser() currentUser?: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.rewardsService.getLeaderboard(currentUser?.userId as UUIDType, groupId),
    );
  }

  @Get("groups")
  @RequirePermission(PERMISSIONS.REWARDS_READ)
  @Validate({
    response: baseResponse(Type.Array(rewardGroupSchema)),
  })
  async getGroups() {
    return new BaseResponse(await this.rewardsService.getGroups());
  }

  @Get("rules")
  @RequirePermission(PERMISSIONS.REWARDS_MANAGE)
  @Validate({
    response: baseResponse(Type.Array(rewardRuleSchema)),
  })
  async getRules() {
    return new BaseResponse(await this.rewardsService.getRules());
  }

  @Patch("rules/:actionType")
  @RequirePermission(PERMISSIONS.REWARDS_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "actionType", schema: Type.Enum(REWARD_ACTION_TYPES) },
      { type: "body", schema: updateRewardRuleSchema },
    ],
    response: baseResponse(rewardRuleSchema),
  })
  async updateRule(
    @Param("actionType") actionType: RewardActionType,
    @Body() body: UpdateRewardRuleBody,
  ) {
    return new BaseResponse(await this.rewardsService.updateRule(actionType, body));
  }

  @Get("achievements")
  @RequirePermission(PERMISSIONS.REWARDS_MANAGE)
  @Validate({
    request: [{ type: "query", name: "includeArchived", schema: Type.Optional(Type.Boolean()) }],
    response: baseResponse(Type.Array(rewardAchievementSchema)),
  })
  async getAchievements(@Query("includeArchived") includeArchived?: boolean) {
    return new BaseResponse(await this.rewardsService.getAchievements(Boolean(includeArchived)));
  }

  @Post("achievements")
  @RequirePermission(PERMISSIONS.REWARDS_MANAGE)
  @Validate({
    request: [{ type: "body", schema: upsertRewardAchievementSchema }],
    response: baseResponse(rewardAchievementSchema),
  })
  async createAchievement(@Body() body: UpsertRewardAchievementBody) {
    return new BaseResponse(await this.rewardsService.createAchievement(body));
  }

  @Patch("achievements/:achievementId")
  @RequirePermission(PERMISSIONS.REWARDS_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "achievementId", schema: UUIDSchema },
      { type: "body", schema: upsertRewardAchievementSchema },
    ],
    response: baseResponse(rewardAchievementSchema),
  })
  async updateAchievement(
    @Param("achievementId") achievementId: UUIDType,
    @Body() body: UpsertRewardAchievementBody,
  ) {
    return new BaseResponse(await this.rewardsService.updateAchievement(achievementId, body));
  }

  @Patch("achievements/:achievementId/archive")
  @RequirePermission(PERMISSIONS.REWARDS_MANAGE)
  @Validate({
    request: [{ type: "param", name: "achievementId", schema: UUIDSchema }],
    response: baseResponse(rewardAchievementSchema),
  })
  async archiveAchievement(@Param("achievementId") achievementId: UUIDType) {
    return new BaseResponse(await this.rewardsService.archiveAchievement(achievementId));
  }

  @Post("backfill")
  @RequirePermission(PERMISSIONS.REWARDS_MANAGE)
  @Validate({
    response: baseResponse(rewardsBackfillSchema),
  })
  async backfillCurrentTenant() {
    return new BaseResponse(await this.rewardsService.backfillCurrentTenant());
  }
}
