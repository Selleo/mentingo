import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
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
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";

@Controller("ai")
export class AiController {
  constructor(
    private readonly threadService: ThreadService,
    private readonly aiService: AiService,
  ) {}

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
    const response = await this.aiService.streamMessage(data, OPENAI_MODELS.BASIC, currentUser);
    return response.pipeDataStreamToResponse(res);
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
