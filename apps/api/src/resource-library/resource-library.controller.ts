import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  type SupportedLanguages,
} from "@repo/shared";
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
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { MAX_VIDEO_SIZE } from "src/file/file.constants";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import { RESOURCE_LIBRARY_PERMISSIONS } from "./resource-library.constants";
import { ResourceLibraryService } from "./resource-library.service";
import {
  assetLibraryAssetSchema,
  assetLibraryUsageSchema,
  deleteAssetResponseSchema,
  linkAssetBodySchema,
  linkAssetResponseSchema,
  resourceLibraryAssetTypeSchema,
  unlinkAssetBodySchema,
  unlinkAssetResponseSchema,
  uploadAssetBodySchema,
  uploadAssetResponseSchema,
  type AssetLibraryAsset,
  type AssetLibraryUsage,
  type DeleteAssetResponse,
  type LinkAssetBody,
  type LinkAssetResponse,
  type ResourceLibraryAssetType,
  type UnlinkAssetBody,
  type UnlinkAssetResponse,
  type UploadAssetBody,
  type UploadAssetResponse,
} from "./schemas/resource-library.schema";

@Controller("resource-library")
export class ResourceLibraryController {
  constructor(private readonly resourceLibraryService: ResourceLibraryService) {}

  @Get("assets")
  @RequirePermission(...RESOURCE_LIBRARY_PERMISSIONS)
  @Validate({
    request: [
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "perPage", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "search", schema: Type.Optional(Type.String()) },
      { type: "query", name: "type", schema: Type.Optional(resourceLibraryAssetTypeSchema) },
      { type: "query", name: "language", schema: Type.Optional(supportedLanguagesSchema) },
    ],
    response: paginatedResponse(Type.Array(assetLibraryAssetSchema)),
  })
  async getAssets(
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
    @Query("search") search?: string,
    @Query("type") type?: ResourceLibraryAssetType,
    @Query("language") language?: SupportedLanguages,
  ): Promise<PaginatedResponse<AssetLibraryAsset[]>> {
    const result = await this.resourceLibraryService.getAssets({
      page,
      perPage,
      search,
      type,
      language,
    });

    return new PaginatedResponse(result);
  }

  @Get("assets/:id/usages")
  @RequirePermission(...RESOURCE_LIBRARY_PERMISSIONS)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: Type.Optional(supportedLanguagesSchema) },
    ],
    response: baseResponse(Type.Array(assetLibraryUsageSchema)),
  })
  async getAssetUsages(
    @Param("id") id: UUIDType,
    @Query("language") language?: SupportedLanguages,
  ): Promise<BaseResponse<AssetLibraryUsage[]>> {
    const usages = await this.resourceLibraryService.getAssetUsages(id, language);

    return new BaseResponse(usages);
  }

  @Post("assets/:id/link")
  @RequirePermission(...RESOURCE_LIBRARY_PERMISSIONS)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: linkAssetBodySchema },
    ],
    response: baseResponse(linkAssetResponseSchema),
  })
  async linkAsset(
    @Param("id") id: UUIDType,
    @Body() body: LinkAssetBody,
  ): Promise<BaseResponse<LinkAssetResponse>> {
    const result = await this.resourceLibraryService.linkAsset(id, body);

    return new BaseResponse(result);
  }

  @Post("assets/:id/unlink")
  @RequirePermission(...RESOURCE_LIBRARY_PERMISSIONS)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: unlinkAssetBodySchema },
    ],
    response: baseResponse(unlinkAssetResponseSchema),
  })
  async unlinkAsset(
    @Param("id") id: UUIDType,
    @Body() body: UnlinkAssetBody,
  ): Promise<BaseResponse<UnlinkAssetResponse>> {
    const result = await this.resourceLibraryService.unlinkAsset(id, body);

    return new BaseResponse(result);
  }

  @Post("assets/upload")
  @RequirePermission(...RESOURCE_LIBRARY_PERMISSIONS)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: uploadAssetBodySchema })
  @Validate({
    request: [{ type: "body", schema: uploadAssetBodySchema }],
    response: baseResponse(uploadAssetResponseSchema),
  })
  async uploadAsset(
    @Body(new ValidateMultipartPipe(uploadAssetBodySchema)) body: UploadAssetBody,
    @UploadedFile(
      "file",
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<UploadAssetResponse>> {
    const result = await this.resourceLibraryService.uploadAsset(file, body, currentUser);

    return new BaseResponse(result);
  }

  @Delete("assets/:id")
  @RequirePermission(...RESOURCE_LIBRARY_PERMISSIONS)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(deleteAssetResponseSchema),
  })
  async deleteAsset(@Param("id") id: UUIDType): Promise<BaseResponse<DeleteAssetResponse>> {
    const result = await this.resourceLibraryService.deleteAsset(id);

    return new BaseResponse(result);
  }
}
