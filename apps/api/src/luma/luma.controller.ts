import { ChatOptions, IntegrationIdOptions } from "@japro/luma-sdk";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import {
  LUMA_FILE_INGESTION_ALLOWED_MIME_TYPES,
  LUMA_FILE_INGESTION_MAX_SIZE_BYTES,
} from "@repo/shared";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import { LumaService } from "src/luma/luma.service";
import {
  chatOptionsSchema,
  courseGenerationDraftSchema,
  courseGenerationFileParamsSchema,
  courseGenerationFilesSchema,
  courseGenerationIngestBodySchema,
  courseGenerationMessagesSchema,
  deleteCourseGenerationFileParamsSchema,
  integrationDraftSchema,
  integrationIdSchema,
} from "src/luma/schema/luma.schema";
import { PERMISSIONS } from "src/permission/permission.constants";
import { RequirePermission } from "src/permission/permission.decorator";

import type { CreateDraftOptions, DeleteIngestedDocumentOptions } from "@japro/luma-sdk";

@Controller("luma")
export class LumaController {
  constructor(private readonly lumaService: LumaService) {}

  @Post("course-generation/chat")
  @RequirePermission(PERMISSIONS.LUMA_MANAGE)
  @Validate({
    request: [{ type: "body", schema: chatOptionsSchema }],
  })
  async chatWithCourseGenerationAgent(
    @Body() data: ChatOptions,
    @CurrentUser() currentUser: CurrentUserType,
    @Res() res: Response,
  ) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Vercel-AI-Data-Stream", "v1");

    const response = await this.lumaService.chatWithCourseAgent(data, currentUser);
    const streamState = this.lumaService.createStreamState();

    try {
      for await (const chunk of response.data as AsyncIterable<Buffer>) {
        const transformedChunk = await this.lumaService.handleChunk(chunk, {
          integrationId: data.integrationId,
          currentUser,
          state: streamState,
        });

        if (transformedChunk) res.write(transformedChunk);
      }

      res.end();
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify(err)}\n\n`);
      res.end();
    }
  }

  @Get("course-generation/messages")
  @RequirePermission(PERMISSIONS.LUMA_MANAGE)
  @Validate({
    request: [
      {
        type: "query",
        name: "integrationId",
        schema: integrationIdSchema.properties.integrationId,
      },
    ],
    response: courseGenerationMessagesSchema,
  })
  async getCourseGenerationMessages(
    @Query("integrationId") integrationId: string,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const data: IntegrationIdOptions = { integrationId };

    return this.lumaService.getCourseGenerationMessages(data, currentUser);
  }

  @Get("course-generation/draft")
  @RequirePermission(PERMISSIONS.LUMA_MANAGE)
  @Validate({
    request: [
      {
        type: "query",
        name: "integrationId",
        schema: integrationDraftSchema.properties.integrationId,
      },
      { type: "query", name: "draftName", schema: integrationDraftSchema.properties.draftName },
    ],
    response: courseGenerationDraftSchema,
  })
  async getCourseGenerationDraft(
    @Query("integrationId") integrationId: string,
    @Query("draftName") draftName: string,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const data: CreateDraftOptions = { integrationId, draftName };

    return this.lumaService.getDraft(data, currentUser);
  }

  @Post("course-generation/files/ingest")
  @RequirePermission(PERMISSIONS.LUMA_MANAGE)
  @UseInterceptors(FilesInterceptor("files"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        integrationId: { type: "string", format: "uuid" },
        files: {
          type: "array",
          items: { type: "string", format: "binary" },
        },
      },
      required: ["integrationId", "files"],
    },
  })
  @Validate({
    request: [{ type: "body", schema: courseGenerationIngestBodySchema }],
  })
  async ingestCourseGenerationFiles(
    @Body() data: IntegrationIdOptions,
    @UploadedFiles(
      getBaseFileTypePipe(
        buildFileTypeRegex(LUMA_FILE_INGESTION_ALLOWED_MIME_TYPES),
        LUMA_FILE_INGESTION_MAX_SIZE_BYTES,
        true,
      ).build({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    files: Express.Multer.File[],
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return this.lumaService.ingestCourseGenerationFiles(data, files, currentUser);
  }

  @Delete("course-generation/files/:integrationId/:documentId")
  @RequirePermission(PERMISSIONS.LUMA_MANAGE)
  @Validate({
    request: [
      {
        type: "param",
        name: "integrationId",
        schema: deleteCourseGenerationFileParamsSchema.properties.integrationId,
      },
      {
        type: "param",
        name: "documentId",
        schema: deleteCourseGenerationFileParamsSchema.properties.documentId,
      },
    ],
  })
  async deleteIngestedCourseGenerationFile(
    @Param("integrationId") integrationId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const data: DeleteIngestedDocumentOptions = { integrationId, documentId };

    return this.lumaService.deleteCourseGenerationFile(data, currentUser);
  }

  @Get("course-generation/files/:integrationId")
  @RequirePermission(PERMISSIONS.LUMA_MANAGE)
  @Validate({
    request: [
      {
        type: "param",
        name: "integrationId",
        schema: courseGenerationFileParamsSchema.properties.integrationId,
      },
    ],
    response: courseGenerationFilesSchema,
  })
  async getCourseGenerationFiles(
    @Param("integrationId") integrationId: string,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const data: IntegrationIdOptions = { integrationId };

    return this.lumaService.getCourseGenerationFiles(data, currentUser);
  }
}
