import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { PERMISSIONS, type PermissionKey } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  paginatedResponse,
  UUIDSchema,
  UUIDType,
  type BaseResponse,
  type PaginatedResponse,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CourseChatService } from "src/course-chat/course-chat.service";
import {
  courseChatMessageReactionsUpdatedSchema,
  courseChatMessageSchema,
  courseChatMessagesResponseSchema,
  courseChatPaginationQuerySchema,
  courseChatRepliesResponseSchema,
  courseChatUsersResponseSchema,
  createCourseChatMessageSchema,
  deleteCourseChatMessageResponseSchema,
  toggleCourseChatMessageReactionSchema,
  type CourseChatMessageReactionsUpdatedResponse,
  type CourseChatMessageResponse,
  type CourseChatUserResponse,
  type CreateCourseChatMessageBody,
  type DeleteCourseChatMessageResponse,
  type ToggleCourseChatMessageReactionBody,
} from "src/course-chat/schemas/course-chat.schema";

@Controller("course-chat")
export class CourseChatController {
  constructor(private readonly courseChatService: CourseChatService) {}

  @Get(":courseId/messages")
  @RequirePermission(PERMISSIONS.COURSE_DISCUSSION_READ)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: courseChatPaginationQuerySchema },
      { type: "query", name: "perPage", schema: courseChatPaginationQuerySchema },
    ],
    response: paginatedResponse(courseChatMessagesResponseSchema),
  })
  async getMessages(
    @Param("courseId") courseId: UUIDType,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<PaginatedResponse<CourseChatMessageResponse[]>> {
    return this.courseChatService.getMessages({ courseId, userId, page, perPage });
  }

  @Get(":courseId/users")
  @RequirePermission(PERMISSIONS.COURSE_DISCUSSION_READ)
  @Validate({
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
    response: baseResponse(courseChatUsersResponseSchema),
  })
  async getCourseChatUsers(
    @Param("courseId") courseId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<CourseChatUserResponse[]>> {
    return this.courseChatService.getUsers(courseId, userId);
  }

  @Post(":courseId/messages")
  @RequirePermission(PERMISSIONS.COURSE_DISCUSSION_MESSAGE_CREATE)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: createCourseChatMessageSchema },
    ],
    response: baseResponse(courseChatMessageSchema),
  })
  async createMessage(
    @Param("courseId") courseId: UUIDType,
    @Body() body: CreateCourseChatMessageBody,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<CourseChatMessageResponse>> {
    return this.courseChatService.createMessage(courseId, userId, body);
  }

  @Get("messages/:messageId/replies")
  @RequirePermission(PERMISSIONS.COURSE_DISCUSSION_READ)
  @Validate({
    request: [
      { type: "param", name: "messageId", schema: UUIDSchema },
      { type: "query", name: "page", schema: courseChatPaginationQuerySchema },
      { type: "query", name: "perPage", schema: courseChatPaginationQuerySchema },
    ],
    response: paginatedResponse(courseChatRepliesResponseSchema),
  })
  async getReplies(
    @Param("messageId") messageId: UUIDType,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<PaginatedResponse<CourseChatMessageResponse[]>> {
    return this.courseChatService.getReplies({ messageId, userId, page, perPage });
  }

  @Post("messages/:messageId/reactions")
  @RequirePermission(PERMISSIONS.COURSE_DISCUSSION_MESSAGE_REACT)
  @Validate({
    request: [
      { type: "param", name: "messageId", schema: UUIDSchema },
      { type: "body", schema: toggleCourseChatMessageReactionSchema },
    ],
    response: baseResponse(courseChatMessageReactionsUpdatedSchema),
  })
  async toggleMessageReaction(
    @Param("messageId") messageId: UUIDType,
    @Body() body: ToggleCourseChatMessageReactionBody,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<CourseChatMessageReactionsUpdatedResponse>> {
    return this.courseChatService.toggleMessageReaction(messageId, userId, body);
  }

  @Delete("messages/:messageId")
  @RequirePermission(
    PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE_OWN,
    PERMISSIONS.COURSE_DISCUSSION_MESSAGE_DELETE,
  )
  @Validate({
    request: [{ type: "param", name: "messageId", schema: UUIDSchema }],
    response: baseResponse(deleteCourseChatMessageResponseSchema),
  })
  async deleteMessage(
    @Param("messageId") messageId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("permissions") permissions: PermissionKey[],
  ): Promise<BaseResponse<DeleteCourseChatMessageResponse>> {
    return this.courseChatService.deleteMessage(messageId, userId, permissions ?? []);
  }
}
