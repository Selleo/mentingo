import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  paginatedResponse,
  UUIDSchema,
  UUIDType,
  type BaseResponse,
  type PaginatedResponse,
} from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CourseChatService } from "src/course-chat/course-chat.service";
import {
  courseChatMessageSchema,
  courseChatMessagesResponseSchema,
  courseChatPaginationQuerySchema,
  courseChatThreadsResponseSchema,
  courseChatUsersResponseSchema,
  createCourseChatMessageSchema,
  createCourseChatThreadResponseSchema,
  createCourseChatThreadSchema,
  type CourseChatMessageResponse,
  type CourseChatThreadResponse,
  type CourseChatUserResponse,
  type CreateCourseChatMessageBody,
  type CreateCourseChatThreadBody,
  type CreateCourseChatThreadResponse,
} from "src/course-chat/schemas/course-chat.schema";

@Controller("course-chat")
export class CourseChatController {
  constructor(private readonly courseChatService: CourseChatService) {}

  @Get(":courseId/threads")
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: courseChatPaginationQuerySchema },
      { type: "query", name: "perPage", schema: courseChatPaginationQuerySchema },
    ],
    response: paginatedResponse(courseChatThreadsResponseSchema),
  })
  async getThreads(
    @Param("courseId") courseId: UUIDType,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<PaginatedResponse<CourseChatThreadResponse[]>> {
    return this.courseChatService.getThreads({ courseId, userId, page, perPage });
  }

  @Get(":courseId/users")
  @Validate({
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
    response: baseResponse(courseChatUsersResponseSchema),
  })
  async getUsers(
    @Param("courseId") courseId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<CourseChatUserResponse[]>> {
    return this.courseChatService.getUsers(courseId, userId);
  }

  @Post(":courseId/threads")
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: createCourseChatThreadSchema },
    ],
    response: baseResponse(createCourseChatThreadResponseSchema),
  })
  async createThread(
    @Param("courseId") courseId: UUIDType,
    @Body() body: CreateCourseChatThreadBody,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<CreateCourseChatThreadResponse>> {
    return this.courseChatService.createThread(courseId, userId, body);
  }

  @Get("threads/:threadId/messages")
  @Validate({
    request: [
      { type: "param", name: "threadId", schema: UUIDSchema },
      { type: "query", name: "page", schema: courseChatPaginationQuerySchema },
      { type: "query", name: "perPage", schema: courseChatPaginationQuerySchema },
    ],
    response: paginatedResponse(courseChatMessagesResponseSchema),
  })
  async getMessages(
    @Param("threadId") threadId: UUIDType,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<PaginatedResponse<CourseChatMessageResponse[]>> {
    return this.courseChatService.getMessages({ threadId, userId, page, perPage });
  }

  @Post("threads/:threadId/messages")
  @Validate({
    request: [
      { type: "param", name: "threadId", schema: UUIDSchema },
      { type: "body", schema: createCourseChatMessageSchema },
    ],
    response: baseResponse(courseChatMessageSchema),
  })
  async createMessage(
    @Param("threadId") threadId: UUIDType,
    @Body() body: CreateCourseChatMessageBody,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<CourseChatMessageResponse>> {
    return this.courseChatService.createMessage(threadId, userId, body);
  }
}
