import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { GamificationVisibility, PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { AchievementsService } from "./achievements.service";
import {
  achievementsLanguageSchema,
  GetUserAchievementsSchema,
} from "./schema/achievements.schema";
import { CreateAchievement, createAchievementSchema } from "./schema/createAchievement.schema";
import {
  CreateAchievementLevel,
  createAchievementLevelSchema,
} from "./schema/createAchievementLevel.schema";
import { CreateTranslation, createTranslationSchema } from "./schema/createTranslation.schema";
import { UpdateAchievement, updateAchievementSchema } from "./schema/updateAchievement.schema";
import {
  LevelNumberParam,
  levelNumberParamSchema,
  UpdateAchievementLevel,
} from "./schema/updateAchievementLevel.schema";

@Controller("achievements")
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  async getAchievementsList(
    @Query("is-enabled") isEnabled: boolean,
    @Query("visibility") visibility: GamificationVisibility,
    @Query("trigger-event-type") triggerEventType: string,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return await this.achievementsService.getAchievementsList(
      currentUser,
      isEnabled,
      visibility,
      triggerEventType,
    );
  }

  @Get("user-achievements")
  @Validate({
    response: baseResponse(GetUserAchievementsSchema),
    request: [
      {
        type: "query",
        name: "language",
        schema: achievementsLanguageSchema,
      },
    ],
  })
  async getUserAchievements(
    @Query("language") language: SupportedLanguages,
    @Query("userId") userId?: UUIDType,
  ) {
    return new BaseResponse(await this.achievementsService.getUserAchievements(userId, language));
  }

  @Post()
  @Validate({
    request: [
      {
        type: "body",
        schema: createAchievementSchema,
      },
    ],
  })
  @RequirePermission(PERMISSIONS.ACHIEVEMENTS_CREATE)
  async createAchievement(@Body() createAchievementBody: CreateAchievement) {
    await this.achievementsService.createAchievement(createAchievementBody);
  }

  @Patch(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      {
        type: "body",
        schema: updateAchievementSchema,
      },
    ],
  })
  @RequirePermission(PERMISSIONS.ACHIEVEMENTS_UPDATE)
  async updateAchievement(
    @Param("id") id: UUIDType,
    @Body() updateAchievementBody: UpdateAchievement,
  ) {
    return await this.achievementsService.updateAchievement(id, updateAchievementBody);
  }

  @Delete(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
  })
  @RequirePermission(PERMISSIONS.ACHIEVEMENTS_DELETE)
  async deleteAchievement(@Param("id") id: UUIDType) {
    await this.achievementsService.deleteAchievement(id);
  }

  @Get("levels/:achievementId")
  @Validate({
    request: [{ type: "param", name: "achievementId", schema: UUIDSchema }],
  })
  async getAchievementAllLevels(@Param("achievementId") achievementId: UUIDType) {
    return await this.achievementsService.getAchievementLevels(achievementId);
  }

  @Get("levels/:achievementId/:levelId")
  @Validate({
    request: [
      { type: "param", name: "achievementId", schema: UUIDSchema },
      { type: "param", name: "levelId", schema: levelNumberParamSchema },
    ],
  })
  async getAchievementLevel(
    @Param("achievementId") achievementId: UUIDType,
    @Param("levelId") levelNumber?: LevelNumberParam,
  ) {
    return await this.achievementsService.getAchievementLevels(achievementId, levelNumber);
  }

  @Post("levels/:achievementId")
  @Validate({
    request: [
      {
        type: "param",
        name: "achievementId",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: createAchievementLevelSchema,
      },
    ],
  })
  @RequirePermission(PERMISSIONS.ACHIEVEMENTS_CREATE)
  async createAchievementLevel(
    @Param("achievementId") achievementId: UUIDType,
    @Body() achievementLevelBody: CreateAchievementLevel,
  ) {
    await this.achievementsService.createAchievementLevel(achievementLevelBody, achievementId);
  }

  @Patch("levels/:achievementId/:levelNumber")
  @Validate({
    request: [
      {
        type: "param",
        name: "achievementId",
        schema: UUIDSchema,
      },
      {
        type: "param",
        name: "levelNumber",
        schema: levelNumberParamSchema,
      },
      {
        type: "body",
        schema: createAchievementLevelSchema,
      },
    ],
  })
  @RequirePermission(PERMISSIONS.ACHIEVEMENTS_UPDATE)
  async updateAchievementLevel(
    @Param("achievementId") achievementId: UUIDType,
    @Param("levelNumber") levelNumber: number,
    @Body() updateAchievementLevelBody: UpdateAchievementLevel,
  ) {
    await this.achievementsService.updateAchievementLevel(
      updateAchievementLevelBody,
      achievementId,
      levelNumber,
    );
  }

  @Delete("levels/:achievementId")
  @RequirePermission(PERMISSIONS.ACHIEVEMENTS_DELETE)
  async deleteAchievementLevel(@Param("achievementId") achievementId: UUIDType) {
    await this.achievementsService.deleteAchievementLevel(achievementId);
  }

  @Post(":achievementId/translation")
  @Validate({
    request: [
      {
        type: "param",
        name: "achievementId",
        schema: UUIDSchema,
      },
      {
        type: "query",
        name: "language",
        schema: achievementsLanguageSchema,
      },
      {
        type: "body",
        schema: createTranslationSchema,
      },
    ],
  })
  @RequirePermission(PERMISSIONS.ACHIEVEMENTS_CREATE)
  async createTranslation(
    @Param("achievementId") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @Body() translationBody: CreateTranslation,
  ) {
    await this.achievementsService.createTranslation(id, language, translationBody.title);
  }

  @Get(":id")
  @Validate({
    request: [
      {
        type: "param",
        name: "id",
        schema: UUIDSchema,
      },
      {
        type: "query",
        name: "language",
        schema: achievementsLanguageSchema,
      },
    ],
  })
  async getAchievement(@Param("id", ParseUUIDPipe) id: UUIDType) {
    return await this.achievementsService.getAchievement(id);
  }
}
