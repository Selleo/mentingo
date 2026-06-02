import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiResponse } from "@nestjs/swagger";
import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  FEATURES,
  LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  type LiveTrainingResourceRelationshipType,
  type SupportedLanguages,
} from "@repo/shared";
import { Validate } from "nestjs-typebox";

import {
  BaseResponse,
  PaginatedResponse,
  UUIDSchema,
  baseResponse,
  type UUIDType,
} from "src/common";
import { RequireFeature } from "src/common/decorators/require-feature.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { FeaturesGuard } from "src/common/guards/features.guard";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { MAX_VIDEO_SIZE } from "src/file/file.constants";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";

import { LiveTrainingService } from "./live-training.service";
import {
  createLiveTrainingResponseSchema,
  createLiveTrainingSchema,
  type CreateLiveTrainingBody,
} from "./schemas/create-live-training.schema";
import {
  liveTrainingDeleteResponseSchema,
  liveTrainingMaterialSchema,
  liveTrainingResourceDownloadSchema,
  type LiveTrainingDeleteResponse,
  type LiveTrainingMaterial,
  type LiveTrainingResourceDownload,
} from "./schemas/live-training-common.schema";
import {
  liveTrainingDetailsResponseSchema,
  type LiveTrainingDetails,
} from "./schemas/live-training-details.schema";
import {
  liveTrainingHostCandidatesQuerySchema,
  liveTrainingHostCandidatesResponseSchema,
  type LiveTrainingHostCandidatesQuery,
  type LiveTrainingHostCandidatesResponse,
} from "./schemas/live-training-host-candidates.schema";
import {
  liveTrainingListQuerySchema,
  type LiveTrainingListQuery,
} from "./schemas/live-training-list-query.schema";
import {
  liveTrainingListResponseSchema,
  type LiveTrainingListItem,
} from "./schemas/live-training-list.schema";
import {
  updateLiveTrainingResponseSchema,
  updateLiveTrainingSchema,
  type UpdateLiveTrainingBody,
} from "./schemas/update-live-training.schema";

@UseGuards(FeaturesGuard, PermissionsGuard)
@RequireFeature(FEATURES.LIVE_TRAINING)
@Controller("live-training")
export class LiveTrainingController {
  constructor(private readonly liveTrainingService: LiveTrainingService) {}

  @Get()
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_READ)
  @Validate({
    request: [
      { type: "query", name: "page", schema: liveTrainingListQuerySchema.properties.page },
      { type: "query", name: "perPage", schema: liveTrainingListQuerySchema.properties.perPage },
      { type: "query", name: "status", schema: liveTrainingListQuerySchema.properties.status },
      {
        type: "query",
        name: "deliveryType",
        schema: liveTrainingListQuerySchema.properties.deliveryType,
      },
      { type: "query", name: "start", schema: liveTrainingListQuerySchema.properties.start },
      { type: "query", name: "end", schema: liveTrainingListQuerySchema.properties.end },
      { type: "query", name: "courseId", schema: liveTrainingListQuerySchema.properties.courseId },
      { type: "query", name: "language", schema: liveTrainingListQuerySchema.properties.language },
    ],
    response: liveTrainingListResponseSchema,
  })
  async getLiveTrainings(
    @Query("page") page: LiveTrainingListQuery["page"],
    @Query("perPage") perPage: LiveTrainingListQuery["perPage"],
    @Query("status") status: LiveTrainingListQuery["status"],
    @Query("deliveryType") deliveryType: LiveTrainingListQuery["deliveryType"],
    @Query("start") start: LiveTrainingListQuery["start"],
    @Query("end") end: LiveTrainingListQuery["end"],
    @Query("courseId") courseId: LiveTrainingListQuery["courseId"],
    @Query("language") language: LiveTrainingListQuery["language"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<LiveTrainingListItem[]>> {
    const liveTrainings = await this.liveTrainingService.getLiveTrainings(
      {
        page,
        perPage,
        status,
        deliveryType,
        start,
        end,
        courseId,
        language,
      },
      currentUser,
    );

    return new PaginatedResponse(liveTrainings);
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_READ)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: liveTrainingListQuerySchema.properties.language },
    ],
    response: liveTrainingDetailsResponseSchema,
  })
  async getLiveTraining(
    @Param("id") id: UUIDType,
    @Query("language") language: LiveTrainingListQuery["language"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingDetails>> {
    const liveTraining = await this.liveTrainingService.getLiveTraining(id, language, currentUser);

    return new BaseResponse(liveTraining);
  }

  @Post()
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_CREATE)
  @Validate({
    request: [{ type: "body", schema: createLiveTrainingSchema }],
    response: createLiveTrainingResponseSchema,
  })
  async createLiveTraining(
    @Body() body: CreateLiveTrainingBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingDetails>> {
    const liveTraining = await this.liveTrainingService.createLiveTraining(
      body,
      body.language,
      currentUser,
    );

    return new BaseResponse(liveTraining);
  }

  @Get(":id/host-candidates")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_UPDATE, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      {
        type: "query",
        name: "page",
        schema: liveTrainingHostCandidatesQuerySchema.properties.page,
      },
      {
        type: "query",
        name: "perPage",
        schema: liveTrainingHostCandidatesQuerySchema.properties.perPage,
      },
      {
        type: "query",
        name: "keyword",
        schema: liveTrainingHostCandidatesQuerySchema.properties.keyword,
      },
    ],
    response: liveTrainingHostCandidatesResponseSchema,
  })
  async getHostCandidates(
    @Param("id") id: UUIDType,
    @Query("page") page: LiveTrainingHostCandidatesQuery["page"],
    @Query("perPage") perPage: LiveTrainingHostCandidatesQuery["perPage"],
    @Query("keyword") keyword: LiveTrainingHostCandidatesQuery["keyword"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<LiveTrainingHostCandidatesResponse["data"]>> {
    const candidates = await this.liveTrainingService.getHostCandidates(
      id,
      { page, perPage, keyword },
      currentUser,
    );

    return new PaginatedResponse(candidates);
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_UPDATE, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateLiveTrainingSchema },
    ],
    response: updateLiveTrainingResponseSchema,
  })
  async updateLiveTraining(
    @Param("id") id: UUIDType,
    @Body() body: UpdateLiveTrainingBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingDetails>> {
    const liveTraining = await this.liveTrainingService.updateLiveTraining(
      id,
      body,
      body.language,
      currentUser,
    );

    return new BaseResponse(liveTraining);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_DELETE, PERMISSIONS.LIVE_TRAINING_DELETE_OWN)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(liveTrainingDeleteResponseSchema),
  })
  async deleteLiveTraining(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingDeleteResponse>> {
    await this.liveTrainingService.deleteLiveTraining(id, currentUser);

    return new BaseResponse({ message: "liveTrainingView.deleteDialog.toast.success" });
  }

  @Post(":id/resources")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_UPDATE, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        relationshipType: {
          type: "string",
          enum: Object.values(LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES),
        },
        language: {
          type: "string",
          enum: Object.values(SUPPORTED_LANGUAGES),
        },
      },
      required: ["file", "relationshipType", "language"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Live Training resource uploaded successfully",
  })
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(liveTrainingMaterialSchema),
  })
  async uploadLiveTrainingResource(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
    @UploadedFile(
      getBaseFileTypePipe(
        buildFileTypeRegex([
          ...ALLOWED_PDF_FILE_TYPES,
          ...ALLOWED_EXCEL_FILE_TYPES,
          ...ALLOWED_WORD_FILE_TYPES,
          ...ALLOWED_VIDEO_FILE_TYPES,
          ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
          ...ALLOWED_PRESENTATION_FILE_TYPES,
        ]),
        MAX_VIDEO_SIZE,
      ).build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
    @Body("relationshipType") relationshipType: LiveTrainingResourceRelationshipType,
    @Body("language") language: SupportedLanguages,
  ): Promise<BaseResponse<LiveTrainingMaterial>> {
    const material = await this.liveTrainingService.uploadLiveTrainingResource(
      id,
      file,
      relationshipType,
      language,
      currentUser,
    );

    return new BaseResponse(material);
  }

  @Get(":id/resources/:resourceId/download")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_READ)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "param", name: "resourceId", schema: UUIDSchema },
      { type: "query", name: "language", schema: liveTrainingListQuerySchema.properties.language },
    ],
    response: baseResponse(liveTrainingResourceDownloadSchema),
  })
  async getLiveTrainingResourceDownloadUrl(
    @Param("id") id: UUIDType,
    @Param("resourceId") resourceId: UUIDType,
    @Query("language") language: LiveTrainingListQuery["language"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingResourceDownload>> {
    const download = await this.liveTrainingService.getLiveTrainingResourceDownloadUrl(
      id,
      resourceId,
      language,
      currentUser,
    );

    return new BaseResponse(download);
  }

  @Delete(":id/resources/:resourceId")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_UPDATE, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "param", name: "resourceId", schema: UUIDSchema },
      { type: "query", name: "language", schema: liveTrainingListQuerySchema.properties.language },
    ],
    response: baseResponse(liveTrainingDeleteResponseSchema),
  })
  async deleteLiveTrainingResource(
    @Param("id") id: UUIDType,
    @Param("resourceId") resourceId: UUIDType,
    @Query("language") language: LiveTrainingListQuery["language"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingDeleteResponse>> {
    await this.liveTrainingService.deleteLiveTrainingResource(
      id,
      resourceId,
      language,
      currentUser,
    );

    return new BaseResponse({ message: "liveTrainingView.files.toast.removed" });
  }
}
