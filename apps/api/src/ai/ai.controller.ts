import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import {
  aiMentorPracticeSessionSchema,
  createAiMentorPracticeSchema,
  nullableAiMentorPracticeSessionSchema,
  type CreateAiMentorPracticeBody,
} from "src/ai/ai-practice.schema";
import { AiPracticeService } from "src/ai/services/ai-practice.service";
import { AiService } from "src/ai/services/ai.service";
import { ThreadService } from "src/ai/services/thread.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import {
  type ResponseJudgeBody,
  responseJudgeSchema,
  type ResponseThreadBody,
  type ResponseThreadMessageBody,
  responseThreadMessageSchema,
  responseThreadSchema,
  type StreamChatBody,
  streamChatSchema,
} from "src/ai/utils/ai.schema";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";
import { BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

@Controller("ai")
export class AiController {
  constructor(
    private readonly threadService: ThreadService,
    private readonly aiService: AiService,
    private readonly aiPracticeService: AiPracticeService,
  ) {}

  @Get("practice/today")
  @RequirePermission(PERMISSIONS.AI_USE)
  @Validate({
    request: [{ type: "query", name: "timezone", schema: Type.String() }],
    response: baseResponse(nullableAiMentorPracticeSessionSchema),
  })
  async getTodayPractice(
    @Query("timezone") timezone: string,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(await this.aiPracticeService.getToday(timezone, currentUser));
  }

  @Post("practice")
  @RequirePermission(PERMISSIONS.AI_USE)
  @Validate({
    request: [{ type: "body", schema: createAiMentorPracticeSchema }],
    response: baseResponse(aiMentorPracticeSessionSchema),
  })
  async createPractice(
    @Body() body: CreateAiMentorPracticeBody,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(await this.aiPracticeService.create(body, currentUser));
  }

  @Get("practice/:id")
  @RequirePermission(PERMISSIONS.AI_USE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(aiMentorPracticeSessionSchema),
  })
  async getPractice(@Param("id") id: UUIDType, @CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(await this.aiPracticeService.getById(id, currentUser));
  }

  @Post("practice/:id/retry")
  @RequirePermission(PERMISSIONS.AI_USE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(aiMentorPracticeSessionSchema),
  })
  async retryPractice(@Param("id") id: UUIDType, @CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(await this.aiPracticeService.retry(id, currentUser));
  }

  @Get("thread")
  @RequirePermission(PERMISSIONS.AI_USE)
  @Validate({
    request: [{ type: "query" as const, name: "thread", schema: UUIDSchema }],
    response: baseResponse(responseThreadSchema),
  })
  async getThread(
    @Query("thread") threadId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ResponseThreadBody>> {
    return await this.threadService.findThread(threadId, currentUser);
  }

  @Get("thread/messages")
  @RequirePermission(PERMISSIONS.AI_USE)
  @Validate({
    request: [{ type: "query" as const, name: "thread", schema: UUIDSchema }],
    response: baseResponse(Type.Array(responseThreadMessageSchema)),
  })
  async getThreadMessages(
    @Query("thread") threadId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ResponseThreadMessageBody[]>> {
    return await this.threadService.findAllMessagesByThread(threadId, currentUser);
  }

  @Post("chat")
  @RequirePermission(PERMISSIONS.AI_USE)
  @Validate({
    request: [{ type: "body", schema: streamChatSchema }],
  })
  async streamChat(
    @Body() data: StreamChatBody,
    @CurrentUser() currentUser: CurrentUserType,
    @Res() res: Response,
  ) {
    const stream = await this.aiService.createChatMessageUiStream(
      data,
      OPENAI_MODELS.BASIC,
      currentUser,
    );
    const { pipeUIMessageStreamToResponse } = await loadAiSdk();

    return pipeUIMessageStreamToResponse({
      response: res,
      stream,
    });
  }

  @Post("judge/:threadId")
  @RequirePermission(PERMISSIONS.AI_USE)
  @Validate({
    request: [{ type: "param", name: "threadId", schema: UUIDSchema }],
    response: baseResponse(responseJudgeSchema),
  })
  async judgeThread(
    @Param("threadId") threadId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ResponseJudgeBody>> {
    return await this.aiService.runJudge({ threadId, userId: currentUser.userId }, currentUser);
  }

  @Post("retake/:lessonId")
  @RequirePermission(PERMISSIONS.AI_USE)
  @Validate({
    request: [{ type: "param", name: "lessonId", schema: UUIDSchema }],
  })
  async retakeLesson(
    @Param("lessonId") lessonId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.aiService.retakeLesson(lessonId, currentUser);
  }
}
