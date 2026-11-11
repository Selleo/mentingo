import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { AchievementAdminService } from "./achievement-admin.service";
import {
  achievementMessageResponseSchema,
  adminAchievementDetailsSchema,
  adminAchievementSchema,
  createAchievementResponseSchema,
  updateAchievementStatusSchema,
  upsertAchievementSchema,
  type AchievementMessageResponse,
  type AdminAchievement,
  type AdminAchievementDetails,
  type CreateAchievementResponse,
  type UpdateAchievementStatusBody,
  type UpsertAchievementBody,
} from "./schemas/achievement-admin.schema";

@Controller("gamification/admin/achievements")
export class AchievementAdminController {
  constructor(private readonly achievementAdminService: AchievementAdminService) {}

  @Get()
  @RequirePermission(PERMISSIONS.GAMIFICATION_MANAGE)
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: baseResponse(Type.Array(adminAchievementSchema)),
  })
  async getAdminAchievements(
    @Query("language") language: SupportedLanguages,
  ): Promise<BaseResponse<AdminAchievement[]>> {
    return new BaseResponse(await this.achievementAdminService.getAchievements(language));
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.GAMIFICATION_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(adminAchievementDetailsSchema),
  })
  async getAdminAchievement(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
  ): Promise<BaseResponse<AdminAchievementDetails>> {
    return new BaseResponse(await this.achievementAdminService.getAchievement(id, language));
  }

  @Post()
  @RequirePermission(PERMISSIONS.GAMIFICATION_MANAGE)
  @Validate({
    request: [{ type: "body", schema: upsertAchievementSchema }],
    response: baseResponse(createAchievementResponseSchema),
  })
  async createAchievement(
    @Body() body: UpsertAchievementBody,
    @CurrentUser("tenantId") tenantId: UUIDType,
  ): Promise<BaseResponse<CreateAchievementResponse>> {
    return new BaseResponse(await this.achievementAdminService.createAchievement(body, tenantId));
  }

  @Put(":id")
  @RequirePermission(PERMISSIONS.GAMIFICATION_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: upsertAchievementSchema },
    ],
    response: baseResponse(achievementMessageResponseSchema),
  })
  async updateAchievement(
    @Param("id") id: UUIDType,
    @Body() body: UpsertAchievementBody,
    @CurrentUser("tenantId") tenantId: UUIDType,
  ): Promise<BaseResponse<AchievementMessageResponse>> {
    await this.achievementAdminService.updateAchievement(id, body, tenantId);

    return new BaseResponse({ message: "gamification.admin.toast.achievementSaved" });
  }

  @Patch(":id/status")
  @RequirePermission(PERMISSIONS.GAMIFICATION_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateAchievementStatusSchema },
    ],
    response: baseResponse(achievementMessageResponseSchema),
  })
  async updateAchievementStatus(
    @Param("id") id: UUIDType,
    @Body() body: UpdateAchievementStatusBody,
    @CurrentUser("tenantId") tenantId: UUIDType,
  ): Promise<BaseResponse<AchievementMessageResponse>> {
    await this.achievementAdminService.updateAchievementStatus(id, body.isEnabled, tenantId);

    return new BaseResponse({ message: "gamification.admin.toast.achievementSaved" });
  }
}
