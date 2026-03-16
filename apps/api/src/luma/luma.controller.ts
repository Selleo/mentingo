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
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import {
  LUMA_FILE_INGESTION_ALLOWED_MIME_TYPES,
  LUMA_FILE_INGESTION_MAX_SIZE_BYTES,
  SupportedLanguages,
} from "@repo/shared";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
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
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { CreateDraftOptions, DeleteIngestedDocumentOptions } from "@japro/luma-sdk";

@Controller("luma")
@UseGuards(RolesGuard)
export class LumaController {
  constructor(private readonly lumaService: LumaService) {}

  @Post("course-generation/chat")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @Validate({
    request: [
      {
        type: "query",
        name: "integrationId",
        schema: integrationDraftSchema.properties.integrationId,
      },
      { type: "query", name: "draftName", schema: integrationDraftSchema.properties.draftName },
      {
        type: "query",
        name: "courseLanguage",
        schema: integrationDraftSchema.properties.courseLanguage,
      },
    ],
    response: courseGenerationDraftSchema,
  })
  async getCourseGenerationDraft(
    @Query("integrationId") integrationId: string,
    @Query("draftName") draftName: string,
    @Query("courseLanguage") courseLanguage: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const data: CreateDraftOptions = { integrationId, draftName, courseLanguage };

    return this.lumaService.getDraft(data, currentUser);
  }

  @Post("course-generation/files/ingest")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
