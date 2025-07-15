import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { AiService } from "src/ai/services/ai.service";
import { StreamingService } from "src/ai/services/streaming.service";
import { ThreadService } from "src/ai/services/thread.service";
import {
  type CreateThreadBody,
  type CreateThreadMessageBody,
  createThreadMessageSchema,
  requestThreadSchema,
  type ResponseChatBody,
  responseChatSchema,
  type ResponseJudgeBody,
  responseJudgeSchema,
  type ResponseThreadBody,
  type ResponseThreadMessageBody,
  responseThreadMessageSchema,
  responseThreadSchema,
  StreamChatBody,
  streamChatSchema,
} from "src/ai/utils/ai.schema";
import { OPENAI_MODELS, THREAD_STATUS } from "src/ai/utils/ai.type";
import { type BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES, UserRole } from "src/user/schemas/userRoles";

@Controller("ai")
@UseGuards(RolesGuard)
export class AiController {
  constructor(
    private readonly threadService: ThreadService,
    private readonly aiService: AiService,
    private readonly streamingService: StreamingService,
  ) {}

  @Post("thread")
  @Validate({
    request: [{ type: "body", schema: requestThreadSchema }],
    response: baseResponse(responseThreadSchema),
  })
  async createThread(
    @Body() data: CreateThreadBody,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") role: UserRole,
  ): Promise<BaseResponse<ResponseThreadBody>> {
    return this.threadService.createThread(
      {
        ...data,
        status: THREAD_STATUS.ACTIVE,
        userId: userId,
      },
      role,
    );
  }
  @Get("thread")
  @Validate({
    request: [{ type: "query" as const, name: "thread", schema: UUIDSchema }],
    response: baseResponse(responseThreadSchema),
  })
  async getThread(
    @Query("thread") threadId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<ResponseThreadBody>> {
    return await this.threadService.findThread(threadId, userId);
  }

  @Get("threads")
  @Validate({
    request: [{ type: "query" as const, name: "lesson", schema: UUIDSchema }],
    response: baseResponse(Type.Array(responseThreadSchema)),
  })
  async getThreads(
    @Query("lesson") lessonId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<ResponseThreadBody[]>> {
    return await this.threadService.findAllThreadsByLessonIdAndUserId(lessonId, userId);
  }

  @Get("thread/messages")
  @Validate({
    request: [{ type: "query" as const, name: "thread", schema: UUIDSchema }],
    response: baseResponse(Type.Array(responseThreadMessageSchema)),
  })
  async getThreadMessages(
    @Query("thread") threadId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<ResponseThreadMessageBody[]>> {
    return await this.threadService.findAllMessagesByThread(threadId, userId);
  }

  @Post("chat")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    request: [{ type: "body", schema: createThreadMessageSchema }],
    response: responseChatSchema,
  })
  async chat(
    @Body() data: CreateThreadMessageBody,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<ResponseChatBody> {
    return this.aiService.generateMessage(data, OPENAI_MODELS.BASIC, userId);
  }

  @Post("chat/stream")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    request: [{ type: "body", schema: streamChatSchema }],
  })
  async streamChat(
    @Body() data: StreamChatBody,
    @CurrentUser("userId") userId: UUIDType,
    @Res() res: Response,
  ) {
    const response = await this.streamingService.streamMessage(data, OPENAI_MODELS.BASIC, userId);
    return response.pipeDataStreamToResponse(res);
  }

  @Post("judge/:threadId")
  @Validate({
    request: [{ type: "param", name: "threadId", schema: UUIDSchema }],
    response: baseResponse(responseJudgeSchema),
  })
  async judgeThread(
    @Param("threadId") threadId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<ResponseJudgeBody>> {
    return await this.aiService.runJudge({ threadId, userId });
  }
}
