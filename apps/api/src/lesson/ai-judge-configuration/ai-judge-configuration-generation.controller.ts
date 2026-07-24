import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import {
  aiJudgeConfigurationValidationResultSchema,
  aiJudgeGenerationSnapshotSchema,
  cancelAiJudgeGenerationResponseSchema,
  generateAiJudgeConfigurationInputSchema,
  startAiJudgeGenerationResponseSchema,
  validateAiJudgeConfigurationInputSchema,
  GenerateAiJudgeConfigurationInput,
  ValidateAiJudgeConfigurationInput,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import { BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { AiJudgeConfigurationGenerationQueueService } from "./ai-judge-configuration-generation-queue.service";
import { AiJudgeConfigurationGenerationService } from "./ai-judge-configuration-generation.service";

import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeGenerationSnapshot,
  CancelAiJudgeGenerationResponse,
  StartAiJudgeGenerationResponse,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";

@Controller("ai/judge-configuration")
@RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
export class AiJudgeConfigurationGenerationController {
  constructor(
    private readonly aiJudgeConfigurationGenerationService: AiJudgeConfigurationGenerationService,
    private readonly aiJudgeConfigurationGenerationQueueService: AiJudgeConfigurationGenerationQueueService,
  ) {}

  @Post("generate")
  @Validate({
    request: [{ type: "body", schema: generateAiJudgeConfigurationInputSchema }],
    response: baseResponse(startAiJudgeGenerationResponseSchema),
  })
  async generate(
    @Body() body: GenerateAiJudgeConfigurationInput,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<StartAiJudgeGenerationResponse>> {
    return new BaseResponse(
      await this.aiJudgeConfigurationGenerationQueueService.start(body, currentUser),
    );
  }

  @Get("generations/:generationId")
  @Validate({
    request: [{ type: "param", name: "generationId", schema: UUIDSchema }],
    response: baseResponse(aiJudgeGenerationSnapshotSchema),
  })
  async getGeneration(
    @Param("generationId") generationId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiJudgeGenerationSnapshot>> {
    return new BaseResponse(
      await this.aiJudgeConfigurationGenerationQueueService.getSnapshot(generationId, currentUser),
    );
  }

  @Post("generations/:generationId/revise")
  @Validate({
    request: [{ type: "param", name: "generationId", schema: UUIDSchema }],
    response: baseResponse(startAiJudgeGenerationResponseSchema),
  })
  async reviseGeneration(
    @Param("generationId") generationId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<StartAiJudgeGenerationResponse>> {
    return new BaseResponse(
      await this.aiJudgeConfigurationGenerationQueueService.revise(generationId, currentUser),
    );
  }

  @Post("generations/:generationId/cancel")
  @Validate({
    request: [{ type: "param", name: "generationId", schema: UUIDSchema }],
    response: baseResponse(cancelAiJudgeGenerationResponseSchema),
  })
  async cancelGeneration(
    @Param("generationId") generationId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CancelAiJudgeGenerationResponse>> {
    return new BaseResponse(
      await this.aiJudgeConfigurationGenerationQueueService.cancel(generationId, currentUser),
    );
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
    return new BaseResponse(
      await this.aiJudgeConfigurationGenerationService.validate(body, currentUser),
    );
  }
}
