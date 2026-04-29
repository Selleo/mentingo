import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { CourseDiscussionsService } from "./course-discussions.service";
import {
  courseDiscussionThreadSchema,
  createCourseDiscussionBodySchema,
} from "./schemas/course-discussion.schema";

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
