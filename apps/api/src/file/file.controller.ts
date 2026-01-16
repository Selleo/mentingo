import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { Validate } from "nestjs-typebox";

import { UUIDSchema, UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, MAX_VIDEO_SIZE } from "src/file/file.constants";
import { FileGuard } from "src/file/guards/file.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { FileService } from "./file.service";
import { bunnyWebhookSchema, type BunnyWebhookBody } from "./schemas/bunny-webhook.schema";
import {
  AssociateLessonWithUploadBody,
  associateLessonWithUploadSchema,
  FileUploadResponse,
} from "./schemas/file.schema";
import {
  s3MultipartCompleteResponseSchema,
  s3MultipartCompleteSchema,
  s3MultipartInitResponseSchema,
  s3MultipartInitSchema,
  s3MultipartSignResponseSchema,
  s3MultipartSignSchema,
  type S3MultipartCompleteBody,
  type S3MultipartCompleteResponse,
  type S3MultipartInitBody,
  type S3MultipartInitResponse,
  type S3MultipartSignBody,
  type S3MultipartSignResponse,
} from "./schemas/s3-multipart.schema";
import {
  videoInitResponseSchema,
  videoInitSchema,
  type VideoInitBody,
  type VideoInitResponse,
} from "./schemas/video-init.schema";
import {
  videoUploadStatusResponseSchema,
  type VideoUploadStatusResponse,
} from "./schemas/video-upload-status.schema";

@UseGuards(RolesGuard)
@Controller("file")
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Roles(...Object.values(USER_ROLES))
  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
        resource: {
          type: "string",
          description: "Optional resource type",
        },
        lessonId: {
          type: "string",
          description: "Optional lesson ID for existing lessons",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded successfully",
    type: FileUploadResponse,
  })
  async uploadFile(
    @UploadedFile()
    file: Express.Multer.File,
    @Body("resource") resource: string = "file",
    @Body("lessonId") lessonId?: UUIDType,
    @CurrentUser("userId") userId?: UUIDType,
  ): Promise<FileUploadResponse> {
    await FileGuard.validateFile(file, {
      allowedTypes: ALLOWED_MIME_TYPES,
      maxSize: MAX_FILE_SIZE,
      maxVideoSize: MAX_VIDEO_SIZE,
    });

    return await this.fileService.uploadFile(file, resource, lessonId, userId);
  }

  @Roles(...Object.values(USER_ROLES))
  @Post("videos/init")
  @Validate({
    request: [{ type: "body", schema: videoInitSchema }],
    response: videoInitResponseSchema,
  })
  async initVideoUpload(
    @Body() payload: VideoInitBody,
    @CurrentUser("userId") userId?: UUIDType,
  ): Promise<VideoInitResponse> {
    return this.fileService.initVideoUpload(payload, userId);
  }

  @Roles(...Object.values(USER_ROLES))
  @Post("videos/s3/multipart/init")
  @Validate({
    request: [{ type: "body", schema: s3MultipartInitSchema }],
    response: s3MultipartInitResponseSchema,
  })
  async initS3MultipartUpload(
    @Body() payload: S3MultipartInitBody,
  ): Promise<S3MultipartInitResponse> {
    return this.fileService.initS3MultipartUpload(payload.uploadId);
  }

  @Roles(...Object.values(USER_ROLES))
  @Post("videos/s3/multipart/sign")
  @Validate({
    request: [{ type: "body", schema: s3MultipartSignSchema }],
    response: s3MultipartSignResponseSchema,
  })
  async signS3MultipartPart(
    @Body() payload: S3MultipartSignBody,
  ): Promise<S3MultipartSignResponse> {
    return this.fileService.signS3MultipartPart(payload.uploadId, payload.partNumber);
  }

  @Roles(...Object.values(USER_ROLES))
  @Post("videos/s3/multipart/complete")
  @Validate({
    request: [{ type: "body", schema: s3MultipartCompleteSchema }],
    response: s3MultipartCompleteResponseSchema,
  })
  async completeS3MultipartUpload(
    @Body() payload: S3MultipartCompleteBody,
  ): Promise<S3MultipartCompleteResponse> {
    return this.fileService.completeS3MultipartUpload(payload.uploadId, payload.parts);
  }

  @Roles(...Object.values(USER_ROLES))
  @Get("videos/:id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: videoUploadStatusResponseSchema,
  })
  async getVideoUploadStatus(@Param("id") id: UUIDType): Promise<VideoUploadStatusResponse> {
    return this.fileService.getVideoUploadStatus(id);
  }

  @Public()
  @Post("bunny/webhook")
  @Validate({
    request: [{ type: "body", schema: bunnyWebhookSchema }],
  })
  async handleBunnyWebhook(@Body() payload: BunnyWebhookBody) {
    return this.fileService.handleBunnyWebhook(payload);
  }

  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Delete()
  @ApiQuery({
    name: "fileKey",
    description: "Key of the file to delete",
    type: "string",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "File deleted successfully",
  })
  async deleteFile(@Query("fileKey") fileKey: string): Promise<void> {
    await this.fileService.deleteFile(fileKey);
  }

  @Post("associate-upload")
  @Validate({
    request: [{ type: "body", schema: associateLessonWithUploadSchema }],
  })
  async associateUploadWithLesson(@Body() data: AssociateLessonWithUploadBody): Promise<void> {
    await this.fileService.associateUploadWithLesson(data.uploadId, data.lessonId);
  }
}
