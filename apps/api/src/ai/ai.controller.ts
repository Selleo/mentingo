import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { AiService } from "src/ai/services/ai.service";
import { ThreadService } from "src/ai/services/thread.service";
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
  ) {}

  @Get("thread")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    request: [{ type: "query" as const, name: "thread", schema: UUIDSchema }],
    response: baseResponse(responseThreadSchema),
  })
  async getThread(
    @Query("thread") threadId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") userRole: UserRole,
  ): Promise<BaseResponse<ResponseThreadBody>> {
    return await this.threadService.findThread(threadId, userId, userRole);
  }

  @Get("thread/messages")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    request: [{ type: "query" as const, name: "thread", schema: UUIDSchema }],
    response: baseResponse(Type.Array(responseThreadMessageSchema)),
  })
  async getThreadMessages(
    @Query("thread") threadId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") userRole: UserRole,
  ): Promise<BaseResponse<ResponseThreadMessageBody[]>> {
    return await this.threadService.findAllMessagesByThread(threadId, userId, userRole);
  }

  @Post("chat")
  @Roles(...Object.values(USER_ROLES))
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
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    request: [{ type: "param", name: "threadId", schema: UUIDSchema }],
    response: baseResponse(responseJudgeSchema),
  })
  async judgeThread(
    @Param("threadId") threadId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") userRole: UserRole,
  ): Promise<BaseResponse<ResponseJudgeBody>> {
    return await this.aiService.runJudge({ threadId, userId }, userRole);
  }

  @Post("retake/:lessonId")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    request: [{ type: "param", name: "lessonId", schema: UUIDSchema }],
  })
  async retakeLesson(
    @Param("lessonId") lessonId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") userRole: UserRole,
  ) {
    await this.aiService.retakeLesson(lessonId, userId, userRole);
  }
}
