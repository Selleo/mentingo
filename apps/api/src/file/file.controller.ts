import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { Validate } from "nestjs-typebox";

import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { FileService } from "./file.service";
import { bunnyWebhookSchema, type BunnyWebhookBody } from "./schemas/bunny-webhook.schema";
import { FileUploadResponse } from "./schemas/file.schema";

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
    @Body("lessonId") lessonId?: string,
  ): Promise<FileUploadResponse> {
    return await this.fileService.uploadFile(file, resource, lessonId);
  }

  @Get("status")
  async getStatus(@Query("uploadId") uploadId: string) {
    return this.fileService.getVideoUploadStatus(uploadId);
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
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        uploadId: {
          type: "string",
          description: "Upload ID to associate with lesson",
        },
        lessonId: {
          type: "string",
          description: "Lesson ID to associate with upload",
        },
      },
      required: ["uploadId", "lessonId"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Upload associated with lesson successfully",
  })
  async associateUploadWithLesson(
    @Body("uploadId") uploadId: string,
    @Body("lessonId") lessonId: string,
  ): Promise<void> {
    await this.fileService.associateUploadWithLesson(uploadId, lessonId);
  }
}
