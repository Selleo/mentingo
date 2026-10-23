import { Body, Controller, Get, Param, ParseBoolPipe, Patch, Post, Query } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { BaseResponse, UUIDSchema } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { AssistantService } from "./assistant.service";
import {
  assistantAvailabilityResponseSchema,
  assistantThreadPageResponseSchema,
  assistantThreadResponseSchema,
  assistantMessagePageResponseSchema,
  assistantSendResponseSchema,
  assistantRunResponseSchema,
  assistantThreadListQuerySchema,
  assistantPageQuerySchema,
  createAssistantThreadSchema,
  updateAssistantThreadSchema,
  sendAssistantMessageSchema,
  CreateAssistantThread,
  UpdateAssistantThread,
  SendAssistantMessage,
} from "./schemas/assistant.schema";

import type {
  AssistantAvailabilityResponse,
  AssistantThreadPageResponse,
  AssistantThreadResponse,
  AssistantMessagePageResponse,
  AssistantSendResponse,
  AssistantRunResponse,
} from "./schemas/assistant.schema";

const threadParam = { type: "param" as const, name: "threadId", schema: UUIDSchema };

@Controller("assistant")
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get("availability")
  @Validate({ response: assistantAvailabilityResponseSchema })
  async getAvailability(
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AssistantAvailabilityResponse>> {
    return new BaseResponse(await this.assistantService.availability(user));
  }

  @Get("threads")
  @Validate({
    request: [
      { type: "query", name: "page", schema: assistantPageQuerySchema.properties.page },
      { type: "query", name: "perPage", schema: assistantPageQuerySchema.properties.perPage },
      {
        type: "query",
        name: "archived",
        pipes: [new ParseBoolPipe({ optional: true })],
        schema: assistantThreadListQuerySchema.allOf[1].properties.archived,
      },
      {
        type: "query",
        name: "query",
        schema: assistantThreadListQuerySchema.allOf[1].properties.query,
      },
    ],
    response: assistantThreadPageResponseSchema,
  })
  async listThreads(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("archived") archived: boolean | undefined,
    @Query("query") query: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AssistantThreadPageResponse>> {
    return new BaseResponse(
      await this.assistantService.listThreads(user, { page, perPage, archived, query }),
    );
  }

  @Post("threads")
  @Validate({
    request: [{ type: "body", schema: createAssistantThreadSchema }],
    response: assistantThreadResponseSchema,
  })
  async createThread(
    @Body() body: CreateAssistantThread,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AssistantThreadResponse>> {
    return new BaseResponse(await this.assistantService.createThread(user, body));
  }

  @Get("threads/:threadId")
  @Validate({ request: [threadParam], response: assistantThreadResponseSchema })
  async getThread(
    @Param("threadId") threadId: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AssistantThreadResponse>> {
    return new BaseResponse(await this.assistantService.getThread(user, threadId));
  }

  @Patch("threads/:threadId")
  @Validate({
    request: [threadParam, { type: "body", schema: updateAssistantThreadSchema }],
    response: assistantThreadResponseSchema,
  })
  async updateThread(
    @Param("threadId") threadId: string,
    @Body() body: UpdateAssistantThread,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AssistantThreadResponse>> {
    return new BaseResponse(await this.assistantService.updateThread(user, threadId, body));
  }

  @Get("threads/:threadId/messages")
  @Validate({
    request: [
      threadParam,
      { type: "query", name: "page", schema: assistantPageQuerySchema.properties.page },
      { type: "query", name: "perPage", schema: assistantPageQuerySchema.properties.perPage },
    ],
    response: assistantMessagePageResponseSchema,
  })
  async listMessages(
    @Param("threadId") threadId: string,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AssistantMessagePageResponse>> {
    return new BaseResponse(
      await this.assistantService.listMessages(user, threadId, { page, perPage }),
    );
  }

  @Post("threads/:threadId/messages")
  @Validate({
    request: [threadParam, { type: "body", schema: sendAssistantMessageSchema }],
    response: assistantSendResponseSchema,
  })
  async sendMessage(
    @Param("threadId") threadId: string,
    @Body() body: SendAssistantMessage,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AssistantSendResponse>> {
    return new BaseResponse(await this.assistantService.sendMessage(user, threadId, body));
  }

  @Post("threads/:threadId/runs/:runId/cancel")
  @Validate({
    request: [threadParam, { type: "param", name: "runId", schema: UUIDSchema }],
    response: assistantRunResponseSchema,
  })
  async cancelRun(
    @Param("threadId") threadId: string,
    @Param("runId") runId: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AssistantRunResponse>> {
    return new BaseResponse(await this.assistantService.cancelRun(user, threadId, runId));
  }
}
