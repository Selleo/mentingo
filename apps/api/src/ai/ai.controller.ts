import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import {
  type CreateThreadBody,
  type CreateThreadMessageBody,
  createThreadMessageSchema,
  requestThreadSchema,
  type ResponseThreadBody,
  responseThreadSchema,
  type ThreadMessageBody,
  threadMessageSchema,
} from "src/ai/ai.schema";
import { OPENAI_MODELS, THREAD_STATUS } from "src/ai/ai.type";
import { AiService } from "src/ai/services/ai.service";
import { ThreadService } from "src/ai/services/thread.service";
import { type BaseResponse, baseResponse, UUIDType } from "src/common";
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

  @Post("chat")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    request: [{ type: "body", schema: createThreadMessageSchema }],
    response: baseResponse(threadMessageSchema),
  })
  async chat(@Body() data: CreateThreadMessageBody): Promise<BaseResponse<ThreadMessageBody>> {
    return this.aiService.generateMessage(data, OPENAI_MODELS.BASIC);
  }
}
