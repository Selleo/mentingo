import {
  Body,
  Controller,
  Delete,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiQuery, ApiResponse } from "@nestjs/swagger";

import { Roles } from "src/common/decorators/roles.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { FileService } from "./file.service";

import type { FileUploadResponse } from "./schemas/file.schema";

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
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded successfully",
    schema: {
      example: {
        fileKey: "bunny-xyz123", // lub "resource/uuid.ext" dla S3
        fileUrl: "https://iframe.mediadelivery.net/embed/470850/xyz123", // lub signed S3 url
        thumbnailUrl: "https://cdn.bunnycdn.com/xyz123/thumbnail.jpg", // lub null
        directPlayUrl: "https://cdn.bunnycdn.com/xyz123/play_480p.mp4", // lub null
      },
    },
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body("resource") resource: string = "file",
  ): Promise<FileUploadResponse> {
    return await this.fileService.uploadFile(file, resource);
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
}
