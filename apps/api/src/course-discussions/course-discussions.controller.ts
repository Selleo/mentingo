import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { CourseDiscussionsService } from "./course-discussions.service";
import {
  courseDiscussionCommentSchema,
  courseDiscussionThreadDetailSchema,
  courseDiscussionThreadSchema,
  createCourseDiscussionCommentBodySchema,
  createCourseDiscussionBodySchema,
  moderateCourseDiscussionBodySchema,
  updateCourseDiscussionBodySchema,
} from "./schemas/course-discussion.schema";

@Controller("discussions")
export class DiscussionDetailsController {
  constructor(private readonly service: CourseDiscussionsService) {}

  @Get(":threadId")
  @Validate({
    request: [{ type: "param", name: "threadId", schema: UUIDSchema, required: true }],
    response: baseResponse(courseDiscussionThreadDetailSchema),
  })
  async detail(@Param("threadId") threadId: UUIDType, @CurrentUser() user: CurrentUserType) {
    return new BaseResponse(await this.service.detail(threadId, user));
  }

  @Patch(":threadId")
  @Validate({
    request: [
      { type: "param", name: "threadId", schema: UUIDSchema, required: true },
      { type: "body", schema: updateCourseDiscussionBodySchema, required: true },
    ],
    response: baseResponse(courseDiscussionThreadSchema),
  })
  async update(
    @Param("threadId") threadId: UUIDType,
    @Body() body: { title?: string; content?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return new BaseResponse(await this.service.updateThread(threadId, user, body));
  }

  @Delete(":threadId")
  @Validate({
    request: [{ type: "param", name: "threadId", schema: UUIDSchema, required: true }],
    response: baseResponse(courseDiscussionThreadSchema),
  })
  async delete(@Param("threadId") threadId: UUIDType, @CurrentUser() user: CurrentUserType) {
    return new BaseResponse(await this.service.deleteThread(threadId, user));
  }

  @Patch(":threadId/moderation")
  @Validate({
    request: [
      { type: "param", name: "threadId", schema: UUIDSchema, required: true },
      { type: "body", schema: moderateCourseDiscussionBodySchema, required: true },
    ],
    response: baseResponse(courseDiscussionThreadSchema),
  })
  async moderateThread(
    @Param("threadId") threadId: UUIDType,
    @Body() body: { hidden: boolean },
    @CurrentUser() user: CurrentUserType,
  ) {
    return new BaseResponse(await this.service.moderateThread(threadId, user, body));
  }

  @Post(":threadId/comments")
  @Validate({
    request: [
      { type: "param", name: "threadId", schema: UUIDSchema, required: true },
      { type: "body", schema: createCourseDiscussionCommentBodySchema, required: true },
    ],
    response: baseResponse(courseDiscussionCommentSchema),
  })
  async createComment(
    @Param("threadId") threadId: UUIDType,
    @Body() body: { content: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return new BaseResponse(await this.service.createComment(threadId, user, body));
  }
}

@Controller("discussion-comments")
export class DiscussionCommentsController {
  constructor(private readonly service: CourseDiscussionsService) {}

  @Patch(":commentId")
  @Validate({
    request: [
      { type: "param", name: "commentId", schema: UUIDSchema, required: true },
      { type: "body", schema: createCourseDiscussionCommentBodySchema, required: true },
    ],
    response: baseResponse(courseDiscussionCommentSchema),
  })
  async updateComment(
    @Param("commentId") commentId: UUIDType,
    @Body() body: { content: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return new BaseResponse(await this.service.updateComment(commentId, user, body));
  }

  @Patch(":commentId/moderation")
  @Validate({
    request: [
      { type: "param", name: "commentId", schema: UUIDSchema, required: true },
      { type: "body", schema: moderateCourseDiscussionBodySchema, required: true },
    ],
    response: baseResponse(courseDiscussionCommentSchema),
  })
  async moderateComment(
    @Param("commentId") commentId: UUIDType,
    @Body() body: { hidden: boolean },
    @CurrentUser() user: CurrentUserType,
  ) {
    return new BaseResponse(await this.service.moderateComment(commentId, user, body));
  }

  @Delete(":commentId")
  @Validate({
    request: [{ type: "param", name: "commentId", schema: UUIDSchema, required: true }],
    response: baseResponse(courseDiscussionCommentSchema),
  })
  async deleteComment(
    @Param("commentId") commentId: UUIDType,
    @CurrentUser() user: CurrentUserType,
  ) {
    return new BaseResponse(await this.service.deleteComment(commentId, user));
  }
}

@Controller("courses")
export class CourseDiscussionsController {
  constructor(private readonly service: CourseDiscussionsService) {}

  @Get(":courseId/discussions")
  @Validate({
    request: [{ type: "param", name: "courseId", schema: UUIDSchema, required: true }],
    response: baseResponse(Type.Array(courseDiscussionThreadSchema)),
  })
  async list(@Param("courseId") courseId: UUIDType, @CurrentUser() user: CurrentUserType) {
    return new BaseResponse(await this.service.list(courseId, user));
  }

  @Post(":courseId/discussions")
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema, required: true },
      { type: "body", schema: createCourseDiscussionBodySchema, required: true },
    ],
    response: baseResponse(courseDiscussionThreadSchema),
  })
  async create(
    @Param("courseId") courseId: UUIDType,
    @Body() body: { title: string; content: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    const [thread] = await this.service.create(courseId, user, body);
    return new BaseResponse(thread);
  }

  @Get(":courseId/lessons/:lessonId/discussions")
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema, required: true },
      { type: "param", name: "lessonId", schema: UUIDSchema, required: true },
    ],
    response: baseResponse(Type.Array(courseDiscussionThreadSchema)),
  })
  async listLesson(
    @Param("courseId") courseId: UUIDType,
    @Param("lessonId") lessonId: UUIDType,
    @CurrentUser() user: CurrentUserType,
  ) {
    return new BaseResponse(await this.service.listLesson(courseId, lessonId, user));
  }

  @Post(":courseId/lessons/:lessonId/discussions")
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema, required: true },
      { type: "param", name: "lessonId", schema: UUIDSchema, required: true },
      { type: "body", schema: createCourseDiscussionBodySchema, required: true },
    ],
    response: baseResponse(courseDiscussionThreadSchema),
  })
  async createLesson(
    @Param("courseId") courseId: UUIDType,
    @Param("lessonId") lessonId: UUIDType,
    @Body() body: { title: string; content: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    const [thread] = await this.service.createLesson(courseId, lessonId, user, body);
    return new BaseResponse(thread);
  }
}
