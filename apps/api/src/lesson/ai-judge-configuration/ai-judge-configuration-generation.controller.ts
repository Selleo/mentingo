import { Body, Controller, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import {
  aiJudgeConfigurationValidationResultSchema,
  aiJudgeGenerationApplicationResultSchema,
  generateAiJudgeConfigurationInputSchema,
  validateAiJudgeConfigurationInputSchema,
  GenerateAiJudgeConfigurationInput,
  ValidateAiJudgeConfigurationInput,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.schema";
import { BaseResponse, baseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { AiJudgeConfigurationGenerationService } from "./ai-judge-configuration-generation.service";

import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeGenerationApplicationResult,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.schema";

@Controller("ai/judge-configuration")
@RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
export class AiJudgeConfigurationGenerationController {
  constructor(private readonly service: AiJudgeConfigurationGenerationService) {}

  @Post("generate")
  @Validate({
    request: [{ type: "body", schema: generateAiJudgeConfigurationInputSchema }],
    response: baseResponse(aiJudgeGenerationApplicationResultSchema),
  })
  async generate(
    @Body() body: GenerateAiJudgeConfigurationInput,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiJudgeGenerationApplicationResult>> {
    return new BaseResponse(await this.service.generate(body, currentUser));
  }

  @Post("validate")
  @Validate({
    request: [{ type: "body", schema: validateAiJudgeConfigurationInputSchema }],
    response: baseResponse(aiJudgeConfigurationValidationResultSchema),
  })
  async validateConfiguration(
    @Body() body: ValidateAiJudgeConfigurationInput,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiJudgeConfigurationValidationResult>> {
    return new BaseResponse(await this.service.validate(body, currentUser));
  }
}
