import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  courseCommentSchema,
  createCourseCommentSchema,
  listCourseCommentsResponseSchema,
  listRepliesResponseSchema,
  updateCourseCommentSchema,
  type CourseComment,
  type CreateCourseCommentBody,
  type ListCourseCommentsResponse,
  type ListRepliesResponse,
  type UpdateCourseCommentBody,
} from "./schemas/courseComment.schema";
import { CourseCommentsService } from "./services/courseComments.service";

const cursorQuerySchema = Type.Optional(Type.String());

@Controller()
@UseGuards(PermissionsGuard)
export class CourseCommentsController {
  constructor(private readonly courseCommentsService: CourseCommentsService) {}

  @Get("courses/:courseId/comments")
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "cursor", schema: cursorQuerySchema },
    ],
    response: baseResponse(listCourseCommentsResponseSchema),
  })
  async listComments(
    @Param("courseId") courseId: UUIDType,
    @Query("cursor") cursor: string | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ListCourseCommentsResponse>> {
    const data = await this.courseCommentsService.listComments(courseId, currentUser, cursor);
    return new BaseResponse(data);
  }

  @Get("courses/:courseId/comments/:commentId/replies")
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "param", name: "commentId", schema: UUIDSchema },
      { type: "query", name: "cursor", schema: cursorQuerySchema },
    ],
    response: baseResponse(listRepliesResponseSchema),
  })
  async listReplies(
    @Param("courseId") courseId: UUIDType,
    @Param("commentId") commentId: UUIDType,
    @Query("cursor") cursor: string | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ListRepliesResponse>> {
    const data = await this.courseCommentsService.listReplies(
      courseId,
      commentId,
      currentUser,
      cursor,
    );
    return new BaseResponse(data);
  }

  @Post("courses/:courseId/comments")
  @HttpCode(HttpStatus.CREATED)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: createCourseCommentSchema },
    ],
    response: baseResponse(courseCommentSchema),
  })
  async createComment(
    @Param("courseId") courseId: UUIDType,
    @Body() body: CreateCourseCommentBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CourseComment>> {
    const data = await this.courseCommentsService.createComment(courseId, body, currentUser);
    return new BaseResponse(data);
  }

  @Patch("comments/:commentId")
  @Validate({
    request: [
      { type: "param", name: "commentId", schema: UUIDSchema },
      { type: "body", schema: updateCourseCommentSchema },
    ],
    response: baseResponse(courseCommentSchema),
  })
  async updateComment(
    @Param("commentId") commentId: UUIDType,
    @Body() body: UpdateCourseCommentBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CourseComment>> {
    const data = await this.courseCommentsService.updateComment(commentId, body, currentUser);
    return new BaseResponse(data);
  }

  @Delete("comments/:commentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Validate({
    request: [{ type: "param", name: "commentId", schema: UUIDSchema }],
  })
  async deleteComment(
    @Param("commentId") commentId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<void> {
    await this.courseCommentsService.deleteComment(commentId, currentUser);
  }
}
