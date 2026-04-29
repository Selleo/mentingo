import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { AchievementsService } from "./achievements.service";
import { profileAchievementsSchema } from "./schemas/achievement.schema";

@UseGuards(PermissionsGuard)
@Controller("achievements")
export class ProfileAchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get("me")
  @Validate({
    request: [
      { type: "query", name: "language", schema: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)) },
    ],
    response: baseResponse(profileAchievementsSchema),
  })
  async findMine(
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.achievementsService.findProfileAchievements({
        userId: currentUser.userId,
        tenantId: currentUser.tenantId,
        language,
      }),
    );
  }
}
