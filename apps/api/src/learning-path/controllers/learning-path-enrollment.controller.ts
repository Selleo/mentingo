import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  BaseResponse,
  baseResponse,
  PaginatedResponse,
  paginatedResponse,
  UUIDSchema,
  type UUIDType,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import {
  sortEnrolledStudentsOptions,
  type SortEnrolledStudentsOptions,
} from "src/courses/schemas/courseQuery";
import { enrolledStudentSchema } from "src/courses/schemas/enrolledStudent.schema";
import { groupsFilterSchema } from "src/group/group.schema";
import { GroupsFilterSchema } from "src/group/group.types";

import { LEARNING_PATH_SUCCESS_MESSAGES } from "../constants/learning-path.success-messages";
import { LearningPathsEnabledGuard } from "../guards/learning-paths-enabled.guard";
import {
  learningPathGroupIdsSchema,
  learningPathMessageResponseSchema,
  learningPathStudentIdsSchema,
  type LearningPathGroupIdsBody,
  type LearningPathMessageResponse,
  type LearningPathStudentIdsBody,
} from "../learning-path.schema";
import { LearningPathService } from "../services/learning-path.service";

import type { EnrolledStudent } from "src/courses/schemas/enrolledStudent.schema";

@Controller("learning-path")
@UseGuards(LearningPathsEnabledGuard)
export class LearningPathEnrollmentController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Get(":learningPathId/enroll-users")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_ENROLLMENT)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "query", name: "keyword", schema: Type.String() },
      { type: "query", name: "sort", schema: sortEnrolledStudentsOptions },
      { type: "query", name: "groups", schema: groupsFilterSchema },
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      { type: "query", name: "perPage", schema: Type.Number() },
    ],
    response: paginatedResponse(Type.Array(enrolledStudentSchema)),
  })
  async getStudentsWithEnrollmentDate(
    @Param("learningPathId") learningPathId: UUIDType,
    @Query("keyword") keyword: string,
    @Query("sort") sort: SortEnrolledStudentsOptions,
    @Query("groups") groups: GroupsFilterSchema,
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<EnrolledStudent[]>> {
    const enrolledStudents = await this.learningPathService.getStudentsWithEnrollmentDate(
      learningPathId,
      { keyword, sort, groups, page, perPage },
      currentUser,
    );

    return new PaginatedResponse(enrolledStudents);
  }

  @Post(":learningPathId/enroll")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_READ, PERMISSIONS.LEARNING_PROGRESS_UPDATE)
  @Validate({
    request: [{ type: "param", name: "learningPathId", schema: UUIDSchema }],
    response: baseResponse(learningPathMessageResponseSchema),
  })
  async enrollCurrentUserToLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathMessageResponse>> {
    await this.learningPathService.enrollCurrentUserToLearningPath(learningPathId, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.USERS_ENROLLED });
  }

  @Post(":learningPathId/enroll-users")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_ENROLLMENT)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathStudentIdsSchema },
    ],
    response: baseResponse(learningPathMessageResponseSchema),
  })
  async enrollUsersToLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathStudentIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathMessageResponse>> {
    await this.learningPathService.enrollUsersToLearningPath(learningPathId, body, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.USERS_ENROLLED });
  }

  @Delete(":learningPathId/enroll-users")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_ENROLLMENT)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathStudentIdsSchema },
    ],
    response: baseResponse(learningPathMessageResponseSchema),
  })
  async unenrollUsersFromLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathStudentIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathMessageResponse>> {
    await this.learningPathService.unenrollUsersFromLearningPath(learningPathId, body, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.USERS_UNENROLLED });
  }

  @Post(":learningPathId/enroll-groups")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_ENROLLMENT)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathGroupIdsSchema },
    ],
    response: baseResponse(learningPathMessageResponseSchema),
  })
  async enrollGroupsToLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathGroupIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathMessageResponse>> {
    await this.learningPathService.enrollGroupsToLearningPath(learningPathId, body, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.GROUPS_ENROLLED });
  }

  @Delete(":learningPathId/enroll-groups")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_ENROLLMENT)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathGroupIdsSchema },
    ],
    response: baseResponse(learningPathMessageResponseSchema),
  })
  async unenrollGroupsFromLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathGroupIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathMessageResponse>> {
    await this.learningPathService.unenrollGroupsFromLearningPath(
      learningPathId,
      body,
      currentUser,
    );

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.GROUPS_UNENROLLED });
  }
}
