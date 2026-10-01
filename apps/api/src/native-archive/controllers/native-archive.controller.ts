import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Head,
  Options,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Request, Response } from "express";
import { diskStorage } from "multer";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  NATIVE_ARCHIVE_DOWNLOAD_FILENAME,
  NATIVE_ARCHIVE_LIMITS,
} from "../native-archive.constants";
import {
  nativeArchiveJobResponseSchema,
  nativeArchiveStatusResponseSchema,
  nativeArchiveTusInitRequestSchema,
  nativeArchiveTusInitResponseSchema,
} from "../schemas/native-archive.schema";
import { NativeArchiveImportService } from "../services/native-archive-import.service";
import { NativeArchiveJobService } from "../services/native-archive-job.service";
import { NativeArchiveTusService } from "../services/native-archive-tus.service";

@Controller("native-archives")
export class NativeArchiveController {
  constructor(
    private readonly nativeArchiveJobService: NativeArchiveJobService,
    private readonly nativeArchiveImportService: NativeArchiveImportService,
    private readonly nativeArchiveTusService: NativeArchiveTusService,
  ) {}

  @Post("tus/init")
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
  @Validate({
    request: [{ type: "body", schema: nativeArchiveTusInitRequestSchema, required: true }],
    response: baseResponse(nativeArchiveTusInitResponseSchema),
  })
  async initTusImport(@Body() body: { sizeBytes: number }, @CurrentUser() actor: CurrentUserType) {
    return new BaseResponse(
      await this.nativeArchiveTusService.createImportUploadSession(body.sizeBytes, actor),
    );
  }

  @Options("tus")
  tusOptionsBase(@Res() response: Response) {
    this.setTusProtocolHeaders(response);

    return response.status(204).send();
  }

  @Options("tus/:id")
  tusOptionsUpload(@Res() response: Response) {
    this.setTusProtocolHeaders(response);

    return response.status(204).send();
  }

  @Post("tus")
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
  async createTusUpload(
    @Req() request: Request,
    @Res() response: Response,
    @CurrentUser() actor: CurrentUserType,
  ) {
    this.assertSupportedTusVersion(request);

    const metadata = String(request.headers["upload-metadata"] ?? "");
    const encodedId = metadata
      .split(",")
      .map((part) => part.trim())
      .find((part) => part.startsWith("uploadId "))
      ?.slice(9);

    const id = encodedId ? Buffer.from(encodedId, "base64").toString("utf8") : "";
    const state = await this.nativeArchiveTusService.getImportUploadSession(id, actor);

    if (Number(request.headers["upload-length"]) !== state.length) {
      throw new BadRequestException("nativeArchive.error.invalidUploadLength");
    }
    this.setTusProtocolHeaders(response, { Location: `/api/native-archives/tus/${id}` });

    return response.status(201).send();
  }

  @Head("tus/:id")
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
  async headTusUpload(
    @Param("id") id: string,
    @Req() request: Request,
    @Res() response: Response,
    @CurrentUser() actor: CurrentUserType,
  ) {
    this.assertSupportedTusVersion(request);

    const state = await this.nativeArchiveTusService.getImportUploadSession(id, actor);
    this.setTusProtocolHeaders(response, {
      "Upload-Offset": String(state.offset),
      "Upload-Length": String(state.length),
    });

    return response.status(200).send();
  }

  @Patch("tus/:id")
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
  async patchTusUpload(
    @Param("id") id: string,
    @Req() request: Request,
    @Res() response: Response,
    @CurrentUser() actor: CurrentUserType,
  ) {
    this.assertSupportedTusVersion(request);

    const offset = Number(request.headers["upload-offset"]);

    if (!Number.isSafeInteger(offset) || !Buffer.isBuffer(request.body)) {
      throw new BadRequestException("nativeArchive.error.invalidUploadChunk");
    }

    const result = await this.nativeArchiveTusService.uploadImportChunk(
      id,
      offset,
      request.body,
      actor,
    );
    this.setTusProtocolHeaders(response, { "Upload-Offset": String(result.offset) });

    return response.status(result.conflict ? 409 : 204).send();
  }

  @Post("tus/:id/complete")
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
  @Validate({
    request: [{ type: "param", name: "id", schema: Type.String(), required: true }],
    response: baseResponse(nativeArchiveJobResponseSchema),
  })
  async completeTusImport(@Param("id") id: string, @CurrentUser() actor: CurrentUserType) {
    const key = await this.nativeArchiveTusService.completeImportUpload(id, actor);
    const result = await this.nativeArchiveJobService.enqueueArchiveImportFromStorageKey(
      key,
      actor,
    );

    await this.nativeArchiveTusService.deleteImportUploadSession(id);

    return new BaseResponse(result);
  }

  private assertSupportedTusVersion(request: Request) {
    if (request.headers["tus-resumable"] !== "1.0.0") {
      throw new BadRequestException("nativeArchive.error.unsupportedTusVersion");
    }
  }

  private setTusProtocolHeaders(response: Response, extra: Record<string, string> = {}) {
    response.set({
      "Tus-Resumable": "1.0.0",
      "Tus-Version": "1.0.0",
      "Tus-Extension": "creation",
      "Tus-Max-Size": String(NATIVE_ARCHIVE_LIMITS.MAX_ARCHIVE_BYTES),
      "Access-Control-Expose-Headers":
        "Tus-Resumable,Tus-Version,Tus-Extension,Tus-Max-Size,Location,Upload-Offset,Upload-Length",
      ...extra,
    });
  }

  @Patch("live-training/:id/dismiss-review")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_UPDATE, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN)
  @Validate({ request: [{ type: "param", name: "id", schema: UUIDSchema, required: true }] })
  async dismissLiveTrainingReview(
    @Param("id") id: UUIDType,
    @CurrentUser() actor: CurrentUserType,
  ) {
    await this.nativeArchiveImportService.dismissImportedLiveTrainingReview(id, actor);

    return new BaseResponse({ dismissed: true });
  }

  @Post("courses/:id/export")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema, required: true }],
    response: baseResponse(nativeArchiveJobResponseSchema),
  })
  async exportNativeCourse(@Param("id") id: UUIDType, @CurrentUser() actor: CurrentUserType) {
    return new BaseResponse(
      await this.nativeArchiveJobService.enqueueArchiveExport("course", id, actor),
    );
  }

  @Post("learning-paths/:id/export")
  @RequirePermission(PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema, required: true }],
    response: baseResponse(nativeArchiveJobResponseSchema),
  })
  async exportNativeLearningPath(@Param("id") id: UUIDType, @CurrentUser() actor: CurrentUserType) {
    return new BaseResponse(
      await this.nativeArchiveJobService.enqueueArchiveExport("learning-path", id, actor),
    );
  }

  @Post("import")
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @Validate({ response: baseResponse(nativeArchiveJobResponseSchema) })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, _file, callback) => callback(null, `mentingo-native-${randomUUID()}.zip`),
      }),
      limits: {
        fileSize: NATIVE_ARCHIVE_LIMITS.MAX_ARCHIVE_BYTES,
        files: NATIVE_ARCHIVE_LIMITS.MAX_UPLOAD_FILES,
      },
    }),
  )
  async importNativeArchive(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: CurrentUserType,
  ) {
    if (!file) throw new BadRequestException("nativeArchive.error.fileRequired");

    return new BaseResponse(
      await this.nativeArchiveJobService.enqueueArchiveImportFromFile(file, actor),
    );
  }

  @Get("jobs/:id")
  @Validate({ response: baseResponse(nativeArchiveStatusResponseSchema) })
  async getNativeArchiveStatus(@Param("id") id: string, @CurrentUser() actor: CurrentUserType) {
    return new BaseResponse(await this.nativeArchiveJobService.getArchiveJobStatus(id, actor));
  }

  @Get("jobs/:id/download")
  async downloadNativeArchive(
    @Param("id") id: string,
    @CurrentUser() actor: CurrentUserType,
    @Res() response: Response,
  ) {
    const file = await this.nativeArchiveJobService.getArchiveDownloadStream(id, actor);
    response.setHeader("Content-Type", "application/zip");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${NATIVE_ARCHIVE_DOWNLOAD_FILENAME}"`,
    );
    response.setHeader("Cache-Control", "private, no-store");

    if (file.contentLength) response.setHeader("Content-Length", file.contentLength);
    file.stream.pipe(response);
  }
}
