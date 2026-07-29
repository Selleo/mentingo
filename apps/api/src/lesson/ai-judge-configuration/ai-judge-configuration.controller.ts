import { Body, Controller, Get, Param, Patch, Put, Query } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, UUIDSchema, baseResponse, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  AiJudgeConfigurationInput,
  UpdateAiJudgeConfigurationTranslationBody,
  aiJudgeConfigurationInputSchema,
  aiJudgeConfigurationResponseSchema,
  updateAiJudgeConfigurationTranslationSchema,
} from "./ai-judge-configuration.schema";
import { AiJudgeConfigurationService } from "./ai-judge-configuration.service";

import type { AiJudgeConfigurationResponse } from "./ai-judge-configuration.schema";

@Controller("lesson/:lessonId/ai-judge-configuration")
@RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
export class AiJudgeConfigurationController {
  constructor(private readonly service: AiJudgeConfigurationService) {}

  @Get()
  @Validate({
    request: [
      { type: "param", name: "lessonId", schema: UUIDSchema },
      {
        type: "query",
        name: "language",
        schema: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
      },
    ],
    response: baseResponse(Type.Union([aiJudgeConfigurationResponseSchema, Type.Null()])),
  })
  async getConfiguration(
    @Param("lessonId") lessonId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiJudgeConfigurationResponse | null>> {
    return new BaseResponse(await this.service.getConfiguration(lessonId, currentUser, language));
  }

  @Put()
  @Validate({
    request: [
      { type: "param", name: "lessonId", schema: UUIDSchema },
      { type: "body", schema: aiJudgeConfigurationInputSchema },
    ],
    response: baseResponse(aiJudgeConfigurationResponseSchema),
  })
  async replaceConfiguration(
    @Param("lessonId") lessonId: UUIDType,
    @Body() body: AiJudgeConfigurationInput,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiJudgeConfigurationResponse>> {
    return new BaseResponse(await this.service.replaceConfiguration(lessonId, body, currentUser));
  }

  @Patch("translations/:language")
  @Validate({
    request: [
      { type: "param", name: "lessonId", schema: UUIDSchema },
      { type: "param", name: "language", schema: Type.Enum(SUPPORTED_LANGUAGES) },
      { type: "body", schema: updateAiJudgeConfigurationTranslationSchema },
    ],
    response: baseResponse(aiJudgeConfigurationResponseSchema),
  })
  async updateTranslations(
    @Param("lessonId") lessonId: UUIDType,
    @Param("language") language: SupportedLanguages,
    @Body() body: UpdateAiJudgeConfigurationTranslationBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiJudgeConfigurationResponse>> {
    return new BaseResponse(
      await this.service.updateTranslations(lessonId, language, body, currentUser),
    );
  }
}
