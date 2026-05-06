import { Body, Controller, Delete, Param, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { LEARNING_PATH_SUCCESS_MESSAGES } from "../constants/learning-path.success-messages";
import {
  learningPathCourseIdsSchema,
  type LearningPathCourseIdsBody,
} from "../learning-path.schema";
import { LearningPathService } from "../services/learning-path.service";

@Controller("learning-path")
export class LearningPathCourseController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Post(":learningPathId/courses")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathCourseIdsSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async addCoursesToLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathCourseIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.learningPathService.addCoursesToLearningPath(learningPathId, body, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.COURSES_ADDED });
  }

  @Delete(":learningPathId/courses/:courseId")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "param", name: "courseId", schema: UUIDSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async removeCourseFromLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Param("courseId") courseId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.learningPathService.removeCourseFromLearningPath(
      learningPathId,
      courseId,
      currentUser,
    );

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.COURSE_REMOVED });
  }

  @Patch(":learningPathId/courses/reorder")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathCourseIdsSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async reorderLearningPathCourses(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathCourseIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.learningPathService.reorderLearningPathCourses(learningPathId, body, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.COURSES_REORDERED });
  }
}
