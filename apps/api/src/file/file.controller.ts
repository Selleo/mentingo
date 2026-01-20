import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Head,
  Options,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { UUIDSchema, UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_VIDEO_SIZE,
  TUS_VERSION,
} from "src/file/file.constants";
import { FileGuard } from "src/file/guards/file.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { FileService } from "./file.service";
import { bunnyWebhookSchema, type BunnyWebhookBody } from "./schemas/bunny-webhook.schema";
import { FileUploadResponse } from "./schemas/file.schema";
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
import { TusUploadService } from "./tus/tus-upload.service";

@UseGuards(RolesGuard)
@Controller("file")
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly tusUploadService: TusUploadService,
  ) {}

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

  @Public()
  @Options("videos/tus")
  async tusOptionsBase(@Res() res: Response) {
    this.setTusHeaders(res);
    return res.status(204).send();
  }

  @Public()
  @Options("videos/tus/:id")
  async tusOptionsUpload(@Res() res: Response) {
    this.setTusHeaders(res);
    return res.status(204).send();
  }

  @Public()
  @Post("videos/tus")
  async createTusUpload(@Req() req: Request, @Res() res: Response) {
    this.ensureTusVersion(req);

    const uploadLength = Number(req.headers["upload-length"]);
    const metadata = this.parseTusMetadata(req.headers["upload-metadata"] as string | undefined);
    const uploadId = metadata.uploadId;

    if (!uploadId) {
      throw new BadRequestException("Missing uploadId");
    }

    const currentUserId = (req as Request & { user?: { userId?: string } }).user?.userId;
    await this.tusUploadService.createSession(uploadId, uploadLength, currentUserId);

    const location = `${req.protocol}://${req.get("host")}${req.originalUrl}/${uploadId}`;
    this.setTusHeaders(res, { Location: location });

    return res.status(201).send();
  }

  @Public()
  @Head("videos/tus/:id")
  async getTusUpload(@Param("id") uploadId: string, @Req() req: Request, @Res() res: Response) {
    this.ensureTusVersion(req);

    const session = await this.tusUploadService.getSession(uploadId);
    if (!session) {
      throw new BadRequestException("Upload session not found");
    }

    this.setTusHeaders(res, {
      "Upload-Offset": String(session.offset),
      "Upload-Length": String(session.uploadLength),
    });

    return res.status(200).send();
  }

  @Public()
  @Patch("videos/tus/:id")
  async patchTusUpload(
    @Param("id") uploadId: string,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser("userId") currentUserId: UUIDType,
  ) {
    this.ensureTusVersion(req);

    const uploadOffset = Number(req.headers["upload-offset"]);
    const chunk = req.body;

    if (Number.isNaN(uploadOffset)) {
      throw new BadRequestException("Missing upload offset");
    }

    if (!Buffer.isBuffer(chunk)) {
      throw new BadRequestException("Missing upload chunk");
    }

    const result = await this.tusUploadService.handlePatch(
      uploadId,
      uploadOffset,
      chunk,
      currentUserId,
    );

    this.setTusHeaders(res, { "Upload-Offset": String(result.offset) });

    if (result.conflict) {
      return res.status(409).send();
    }

    return res.status(204).send();
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

  private setTusHeaders(res: Response, extraHeaders: Record<string, string> = {}) {
    res.set({
      "Tus-Resumable": TUS_VERSION,
      "Tus-Version": TUS_VERSION,
      "Tus-Extension": "creation",
      "Tus-Max-Size": String(MAX_VIDEO_SIZE),
      "Access-Control-Expose-Headers":
        "Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size, Upload-Offset, Upload-Length, Location",
      "Access-Control-Allow-Headers":
        "Tus-Resumable, Upload-Length, Upload-Offset, Upload-Metadata, Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, PATCH, HEAD, OPTIONS",
      ...extraHeaders,
    });
  }

  private ensureTusVersion(req: Request) {
    const version = req.headers["tus-resumable"];
    if (version && version !== TUS_VERSION) {
      throw new BadRequestException("Unsupported TUS version");
    }
  }

  private parseTusMetadata(metadataHeader: string | undefined) {
    if (!metadataHeader) return {} as Record<string, string>;

    return metadataHeader
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, entry) => {
        const [key, value] = entry.split(" ");
        if (!key || !value) return acc;
        acc[key] = Buffer.from(value, "base64").toString("utf8");
        return acc;
      }, {});
  }
}
