import { Body, Controller, Delete, Param, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { LEARNING_PATH_SUCCESS_MESSAGES } from "../constants/learning-path.success-messages";
import {
  learningPathGroupIdsSchema,
  learningPathStudentIdsSchema,
  type LearningPathGroupIdsBody,
  type LearningPathStudentIdsBody,
} from "../learning-path.schema";
import { LearningPathService } from "../services/learning-path.service";

@Controller("learning-path")
export class LearningPathEnrollmentController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Post(":learningPathId/enroll-users")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathStudentIdsSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async enrollUsersToLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathStudentIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.learningPathService.enrollUsersToLearningPath(learningPathId, body, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.USERS_ENROLLED });
  }

  @Delete(":learningPathId/enroll-users")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathStudentIdsSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async unenrollUsersFromLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathStudentIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.learningPathService.unenrollUsersFromLearningPath(learningPathId, body, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.USERS_UNENROLLED });
  }

  @Post(":learningPathId/enroll-groups")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathGroupIdsSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async enrollGroupsToLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathGroupIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.learningPathService.enrollGroupsToLearningPath(learningPathId, body, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.GROUPS_ENROLLED });
  }

  @Delete(":learningPathId/enroll-groups")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: learningPathGroupIdsSchema },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async unenrollGroupsFromLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: LearningPathGroupIdsBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.learningPathService.unenrollGroupsFromLearningPath(
      learningPathId,
      body,
      currentUser,
    );

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.GROUPS_UNENROLLED });
  }
}
