import { Controller, ForbiddenException, Get, Param, Query } from "@nestjs/common";
import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { GamificationService } from "./gamification.service";
import {
  userGamificationProfileSchema,
  type UserGamificationProfileResponse,
} from "./schemas/gamification.schema";

@Controller("gamification")
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  /** Users can only read their own gamification profile for now. */
  @Get("users/:userId")
  @RequirePermission(PERMISSIONS.GAMIFICATION_READ)
  @Validate({
    request: [
      { type: "param", name: "userId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(userGamificationProfileSchema),
  })
  async getUserGamificationProfile(
    @Param("userId") userId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<UserGamificationProfileResponse>> {
    if (userId !== currentUserId) throw new ForbiddenException("common.toast.noAccess");

    return new BaseResponse(await this.gamificationService.getUserProfile(userId, language));
  }
}
