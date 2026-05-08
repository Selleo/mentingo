import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiConsumes } from "@nestjs/swagger";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
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
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import { LEARNING_PATH_SUCCESS_MESSAGES } from "../constants/learning-path.success-messages";
import {
  createLearningPathSchema,
  learningPathDetailSchema,
  learningPathListItemSchema,
  learningPathSchema,
  type CreateLearningPathBody,
  type LearningPathDetailSchema,
  type LearningPathListItemSchema,
  type LearningPathSchema,
  type UpdateLearningPathBody,
  updateLearningPathSchema,
  supportedLanguagesOptions,
} from "../learning-path.schema";
import { LearningPathService } from "../services/learning-path.service";

type LearningPathUploadFiles = {
  thumbnail?: Express.Multer.File[];
  certificateSignature?: Express.Multer.File[];
};

const learningPathFileFields = FileFieldsInterceptor([
  { name: "thumbnail", maxCount: 1 },
  { name: "certificateSignature", maxCount: 1 },
]);
@Controller("learning-path")
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Get()
  @RequirePermission(PERMISSIONS.LEARNING_PATH_READ)
  @Validate({
    request: [
      { type: "query", name: "page", schema: Type.Number({ minimum: 1 }) },
      { type: "query", name: "perPage", schema: Type.Number() },
      { type: "query", name: "language", schema: Type.Optional(supportedLanguagesOptions) },
      { type: "query", name: "searchQuery", schema: Type.Optional(Type.String()) },
    ],
    response: paginatedResponse(Type.Array(learningPathListItemSchema)),
  })
  async getLearningPaths(
    @Query("page") page: number,
    @Query("perPage") perPage: number,
    @Query("language") language: SupportedLanguages,
    @Query("searchQuery") searchQuery: string | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<LearningPathListItemSchema[]>> {
    const learningPaths = await this.learningPathService.getLearningPaths(
      currentUser,
      page,
      perPage,
      language,
      searchQuery,
    );

    return new PaginatedResponse(learningPaths);
  }

  @Get(":learningPathId")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_READ)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "query", name: "language", schema: Type.Optional(supportedLanguagesOptions) },
    ],
    response: baseResponse(learningPathDetailSchema),
  })
  async getLearningPathById(
    @Param("learningPathId") learningPathId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathDetailSchema>> {
    const learningPath = await this.learningPathService.getLearningPathById(
      learningPathId,
      currentUser,
      language,
    );

    return new BaseResponse(learningPath);
  }

  @Post()
  @UseInterceptors(learningPathFileFields)
  @ApiConsumes("multipart/form-data")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_CREATE)
  @Validate({
    request: [
      {
        type: "body",
        schema: createLearningPathSchema,
        pipes: [new ValidateMultipartPipe(createLearningPathSchema)],
      },
    ],
    response: baseResponse(learningPathSchema),
  })
  async createLearningPath(
    @Body() body: CreateLearningPathBody,
    @UploadedFiles()
    files: LearningPathUploadFiles,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathSchema>> {
    const learningPath = await this.learningPathService.createLearningPath(
      body,
      currentUser,
      files?.thumbnail?.[0],
      files?.certificateSignature?.[0],
    );

    return new BaseResponse(learningPath);
  }

  @Patch(":learningPathId")
  @UseInterceptors(learningPathFileFields)
  @ApiConsumes("multipart/form-data")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      {
        type: "body",
        schema: updateLearningPathSchema,
        pipes: [new ValidateMultipartPipe(updateLearningPathSchema)],
      },
    ],
    response: baseResponse(learningPathSchema),
  })
  async updateLearningPath(
    @Param("learningPathId") learningPathId: UUIDType,
    @Body() body: UpdateLearningPathBody,
    @UploadedFiles()
    files: LearningPathUploadFiles,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathSchema>> {
    const learningPath = await this.learningPathService.updateLearningPath(
      learningPathId,
      body,
      currentUser,
      files?.thumbnail?.[0],
      files?.certificateSignature?.[0],
    );

    return new BaseResponse(learningPath);
  }

  @Post(":learningPathId/language")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "learningPathId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesOptions },
    ],
    response: baseResponse(learningPathSchema),
  })
  async createLanguage(
    @Param("learningPathId") learningPathId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LearningPathSchema>> {
    const learningPath = await this.learningPathService.createLanguage(
      learningPathId,
      language,
      currentUser,
    );

    return new BaseResponse(learningPath);
  }

  @Delete(":learningPathId")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_DELETE)
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
