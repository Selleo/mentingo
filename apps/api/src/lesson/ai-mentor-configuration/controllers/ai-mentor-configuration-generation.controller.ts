import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import {
  aiMentorConfigurationGenerationSnapshotSchema,
  aiMentorConfigurationValidationResultSchema,
  cancelAiMentorConfigurationGenerationResponseSchema,
  generateAiMentorConfigurationInputSchema,
  startAiMentorConfigurationGenerationResponseSchema,
  validateAiMentorConfigurationInputSchema,
  type AiMentorConfigurationGenerationSnapshot,
  type AiMentorConfigurationValidationResult,
  type CancelAiMentorConfigurationGenerationResponse,
  type GenerateAiMentorConfigurationInput,
  type StartAiMentorConfigurationGenerationResponse,
  type ValidateAiMentorConfigurationInput,
} from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";
import { BaseResponse, baseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { AiMentorConfigurationGenerationQueueService } from "../generation/ai-mentor-configuration-generation-queue.service";
import { AiMentorConfigurationGenerationService } from "../generation/ai-mentor-configuration-generation.service";

@Controller("ai/mentor-configuration")
@RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
export class AiMentorConfigurationGenerationController {
  constructor(
    private readonly generationService: AiMentorConfigurationGenerationService,
    private readonly queueService: AiMentorConfigurationGenerationQueueService,
  ) {}

  @Post("generate")
  @Validate({
    request: [{ type: "body", schema: generateAiMentorConfigurationInputSchema }],
    response: baseResponse(startAiMentorConfigurationGenerationResponseSchema),
  })
  async generateAiMentorConfiguration(
    @Body() body: GenerateAiMentorConfigurationInput,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<StartAiMentorConfigurationGenerationResponse>> {
    return new BaseResponse(await this.queueService.start(body, currentUser));
  }

  @Get("generations/:generationId")
  @Validate({
    request: [{ type: "param", name: "generationId", schema: UUIDSchema }],
    response: baseResponse(aiMentorConfigurationGenerationSnapshotSchema),
  })
  async getAiMentorConfigurationGeneration(
    @Param("generationId") generationId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiMentorConfigurationGenerationSnapshot>> {
    return new BaseResponse(await this.queueService.getSnapshot(generationId, currentUser));
  }

  @Post("generations/:generationId/revise")
  @Validate({
    request: [{ type: "param", name: "generationId", schema: UUIDSchema }],
    response: baseResponse(startAiMentorConfigurationGenerationResponseSchema),
  })
  async reviseAiMentorConfigurationGeneration(
    @Param("generationId") generationId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<StartAiMentorConfigurationGenerationResponse>> {
    return new BaseResponse(await this.queueService.revise(generationId, currentUser));
  }

  @Post("generations/:generationId/cancel")
  @Validate({
    request: [{ type: "param", name: "generationId", schema: UUIDSchema }],
    response: baseResponse(cancelAiMentorConfigurationGenerationResponseSchema),
  })
  async cancelAiMentorConfigurationGeneration(
    @Param("generationId") generationId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CancelAiMentorConfigurationGenerationResponse>> {
    return new BaseResponse(await this.queueService.cancel(generationId, currentUser));
  }

  @Post("validate")
  @Validate({
    request: [{ type: "body", schema: validateAiMentorConfigurationInputSchema }],
    response: baseResponse(aiMentorConfigurationValidationResultSchema),
  })
  async validateAiMentorConfigurationDraft(
    @Body() body: ValidateAiMentorConfigurationInput,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<AiMentorConfigurationValidationResult>> {
    return new BaseResponse(await this.generationService.validate(body, currentUser));
  }
}
