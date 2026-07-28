import { Body, Controller, Get, Param, Patch, Put, Query } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, UUIDSchema, UUIDType, baseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import {
  AiMentorConfigurationContent,
  UpdateAiMentorConfigurationTranslationBody,
  aiMentorConfigurationContentSchema,
  aiMentorConfigurationResponseSchema,
  updateAiMentorConfigurationTranslationSchema,
} from "../schemas/ai-mentor-configuration.schema";
import { AiMentorConfigurationService } from "../services/ai-mentor-configuration.service";

import type { AiMentorConfigurationResponse } from "../schemas/ai-mentor-configuration.schema";

@Controller("lesson/:lessonId/ai-mentor-configuration")
@RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
export class AiMentorConfigurationController {
  constructor(private readonly aiMentorConfigurationService: AiMentorConfigurationService) {}

  @Get()
  @Validate({
    request: [
      { type: "param", name: "lessonId", schema: UUIDSchema },
      {
        type: "query",
        name: "language",
        schema: Type.Optional(supportedLanguagesSchema),
      },
    ],
    response: baseResponse(aiMentorConfigurationResponseSchema),
  })
  async getAiMentorConfiguration(
    @Param("lessonId") lessonId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiMentorConfigurationResponse>> {
    return new BaseResponse(
      await this.aiMentorConfigurationService.getConfiguration(lessonId, currentUser, language),
    );
  }

  @Put()
  @Validate({
    request: [
      { type: "param", name: "lessonId", schema: UUIDSchema },
      { type: "body", schema: aiMentorConfigurationContentSchema },
    ],
    response: baseResponse(aiMentorConfigurationResponseSchema),
  })
  async replaceAiMentorConfiguration(
    @Param("lessonId") lessonId: UUIDType,
    @Body() body: AiMentorConfigurationContent,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiMentorConfigurationResponse>> {
    return new BaseResponse(
      await this.aiMentorConfigurationService.replaceConfiguration(lessonId, body, currentUser),
    );
  }

  @Patch("translations/:language")
  @Validate({
    request: [
      { type: "param", name: "lessonId", schema: UUIDSchema },
      { type: "param", name: "language", schema: supportedLanguagesSchema },
      { type: "body", schema: updateAiMentorConfigurationTranslationSchema },
    ],
    response: baseResponse(aiMentorConfigurationResponseSchema),
  })
  async updateAiMentorConfigurationTranslations(
    @Param("lessonId") lessonId: UUIDType,
    @Param("language") language: SupportedLanguages,
    @Body() body: UpdateAiMentorConfigurationTranslationBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiMentorConfigurationResponse>> {
    return new BaseResponse(
      await this.aiMentorConfigurationService.updateTranslations(
        lessonId,
        language,
        body,
        currentUser,
      ),
    );
  }
}
