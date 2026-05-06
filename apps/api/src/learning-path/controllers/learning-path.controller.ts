import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
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

import { LEARNING_PATH_SUCCESS_MESSAGES } from "../constants/learning-path.success-messages";
import {
  createLearningPathSchema,
  learningPathDetailSchema,
  learningPathSchema,
  type CreateLearningPathBody,
  type LearningPathDetailSchema,
  type LearningPathSchema,
  type UpdateLearningPathBody,
  updateLearningPathSchema,
} from "../learning-path.schema";
import { LearningPathService } from "../services/learning-path.service";

@Controller("learning-path")
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Get()
  @RequirePermission(PERMISSIONS.LEARNING_PATH_READ)
  @Validate({
    request: [
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      { type: "query", name: "perPage", schema: Type.Number() },
    ],
    response: paginatedResponse(Type.Array(learningPathSchema)),
  })
  async getLearningPaths(
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<LearningPathSchema[]>> {
    const learningPaths = await this.learningPathService.getLearningPaths(
      currentUser,
      page,
      perPage,
    );

    return new PaginatedResponse(learningPaths);
  }

  @Get(":learningPathId")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_READ)
  @Validate({
    request: [{ type: "param", name: "learningPathId", schema: UUIDSchema }],
    response: baseResponse(learningPathDetailSchema),
  })
  async getLearningPathById(
    @Param("learningPathId") learningPathId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathDetailSchema>> {
    const learningPath = await this.learningPathService.getLearningPathById(
      learningPathId,
      currentUser,
    );

    return new BaseResponse(learningPath);
  }

  @Post()
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [{ type: "body", schema: createLearningPathSchema }],
    response: baseResponse(learningPathSchema),
  })
  async createLearningPath(
    @Body() body: CreateLearningPathBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathSchema>> {
    const learningPath = await this.learningPathService.createLearningPath(body, currentUser);

    return new BaseResponse(learningPath);
  }

  @Patch(":learningPathId")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "body", schema: updateLearningPathSchema },
    ],
    response: baseResponse(learningPathSchema),
  })
  async updateLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: UpdateLearningPathBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathSchema>> {
    const learningPath = await this.learningPathService.updateLearningPath(
      learningPathId,
      body,
      currentUser,
    );

    return new BaseResponse(learningPath);
  }

  @Delete(":learningPathId")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_MANAGE)
  @Validate({
    request: [{ type: "param", name: "learningPathId", schema: UUIDSchema }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async deleteLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.learningPathService.deleteLearningPath(learningPathId, currentUser);

    return new BaseResponse({ message: LEARNING_PATH_SUCCESS_MESSAGES.DELETED });
  }
}
