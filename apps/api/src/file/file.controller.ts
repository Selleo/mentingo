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
import { USER_ROLES } from "src/user/schemas/userRoles";

import { FileService } from "./file.service";
import { bunnyWebhookSchema, type BunnyWebhookBody } from "./schemas/bunny-webhook.schema";
import {
  AssociateLessonWithUploadBody,
  associateLessonWithUploadSchema,
  FileUploadResponse,
} from "./schemas/file.schema";
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
    @UploadedFile() file: Express.Multer.File,
    @Body("resource") resource: string = "file",
    @Body("lessonId") lessonId?: UUIDType,
    @CurrentUser("userId") userId?: UUIDType,
  ): Promise<FileUploadResponse> {
    return await this.fileService.uploadFile(file, resource, lessonId, undefined, userId);
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
