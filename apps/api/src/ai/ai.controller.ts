import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { AiService } from "src/ai/services/ai.service";
import { ThreadService } from "src/ai/services/thread.service";
import {
  type CreateThreadBody,
  requestThreadSchema,
  type ResponseJudgeBody,
  responseJudgeSchema,
  type ResponseThreadBody,
  type ResponseThreadMessageBody,
  responseThreadMessageSchema,
  responseThreadSchema,
  type StreamChatBody,
  streamChatSchema,
} from "src/ai/utils/ai.schema";
import { OPENAI_MODELS, THREAD_STATUS } from "src/ai/utils/ai.type";
import { type BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

@Controller("ai")
@UseGuards(RolesGuard)
export class AiController {
  constructor(
    private readonly threadService: ThreadService,
    private readonly aiService: AiService,
  ) {}

  @Post("thread")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    request: [{ type: "body", schema: requestThreadSchema }],
    response: baseResponse(responseThreadSchema),
  })
  async getThreadWithSetup(
    @Body() data: CreateThreadBody,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<ResponseThreadBody>> {
    return this.aiService.getThreadWithSetup({
      ...data,
      status: THREAD_STATUS.ACTIVE,
      userId: userId,
    });
  }

  @Get("thread")
  @Roles(USER_ROLES.STUDENT)
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
  @Roles(USER_ROLES.STUDENT)
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
  @Roles(USER_ROLES.STUDENT)
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
    request: [{ type: "body", schema: streamChatSchema }],
  })
  async streamChat(
    @Body() data: StreamChatBody,
    @CurrentUser("userId") userId: UUIDType,
    @Res() res: Response,
  ) {
    const response = await this.aiService.streamMessage(data, OPENAI_MODELS.BASIC, userId);

    return response.pipeDataStreamToResponse(res);
  }

  @Post("judge/:threadId")
  @Roles(USER_ROLES.STUDENT)
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

  @Post("retake/:lessonId")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    request: [{ type: "param", name: "lessonId", schema: UUIDSchema }],
  })
  async retakeLesson(
    @Param("lessonId") lessonId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ) {
    await this.aiService.retakeLesson(lessonId, userId);
  }
}
