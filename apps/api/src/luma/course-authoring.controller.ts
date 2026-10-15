/** Exposes tenant-protected HTTP endpoints for the course-authoring workspace lifecycle. */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
  ParseUUIDPipe,
  StreamableFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiProduces, ApiOkResponse } from "@nestjs/swagger";
import {
  PERMISSIONS,
  SupportedLanguages,
  COURSE_AUTHORING_SOURCE_FILE_TYPES,
  MAX_COURSE_AUTHORING_SOURCE_SIZE,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, PaginatedResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";

import { CourseAuthoringApplicationService } from "./course-authoring-application.service";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
import { CourseAuthoringSessionService } from "./course-authoring-session.service";
import {
  authoringApplyStatusSchema,
  authoringSourceUploadResponseSchema,
} from "./schema/course-authoring-application.schema";
import {
  prepareAuthoringExportSchema,
  PrepareAuthoringExportBody,
  authoringCommandBodySchema,
  authoringCommandReceiptSchema,
  authoringEventsSchema,
  authoringSessionResponseSchema,
  authoringSessionListResponseSchema,
  authoringSessionListQuerySchema,
  authoringTurnHistoryResponseSchema,
  createAuthoringSessionSchema,
  AuthoringCommandBody,
  CreateAuthoringSessionBody,
} from "./schema/course-authoring-session.schema";
import {
  authoringContextQuerySchema,
  authoringContextResponseSchema,
} from "./schema/course-authoring.schema";

import type {
  AuthoringApplyStatus,
  AuthoringSourceUploadResponse,
} from "./schema/course-authoring-application.schema";
import type {
  AuthoringSession,
  AuthoringSessionSummary,
  AuthoringSessionListQuery,
  AuthoringCommandReceiptResponse,
  AuthoringEventsResponse,
  AuthoringTurnHistory,
} from "./schema/course-authoring-session.schema";
import type { AuthoringCourseContext } from "./schema/course-authoring.schema";
/** Keeps HTTP translation thin while delegating authorization and workflow rules to services. */

@Controller("luma/authoring/courses/:courseId")
export class CourseAuthoringController {
  /** Injects thin adapters for context, session, and application workflows. */
  constructor(
    private readonly contextService: CourseAuthoringContextService,
    private readonly sessionService: CourseAuthoringSessionService,
    private readonly applicationService: CourseAuthoringApplicationService,
  ) {}

  @Post("sessions")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "body", schema: createAuthoringSessionSchema },
    ],
    response: authoringSessionResponseSchema,
  })
  async openAuthoringSession(
    @Param("courseId") courseId: UUIDType,
    @Body() input: CreateAuthoringSessionBody,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringSession>> {
    return new BaseResponse(await this.sessionService.open(courseId, input, actor));
  }

  @Get("sessions")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "page", schema: authoringSessionListQuerySchema.properties.page },
      {
        type: "query",
        name: "perPage",
        schema: authoringSessionListQuerySchema.properties.perPage,
      },
      {
        type: "query",
        name: "keyword",
        schema: authoringSessionListQuerySchema.properties.keyword,
      },
    ],
    response: authoringSessionListResponseSchema,
  })
  async listAuthoringSessions(
    @Param("courseId") courseId: UUIDType,
    @Query("page") page: AuthoringSessionListQuery["page"],
    @Query("perPage") perPage: AuthoringSessionListQuery["perPage"],
    @Query("keyword") keyword: AuthoringSessionListQuery["keyword"],
    @CurrentUser() actor: CurrentUserType,
  ): Promise<PaginatedResponse<AuthoringSessionSummary[]>> {
    return new PaginatedResponse(
      await this.sessionService.list(courseId, actor, { page, perPage, keyword }),
    );
  }

  @Get("sessions/:sessionId")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
    ],
    response: authoringSessionResponseSchema,
  })
  async getAuthoringSession(
    @Param("courseId") courseId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringSession>> {
    return new BaseResponse(await this.sessionService.get(courseId, sessionId, actor));
  }

  /** Returns an authorized older page without expanding the current session snapshot. */
  @Get("sessions/:sessionId/turns")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
      { type: "query", name: "beforeRequestId", schema: UUIDSchema },
    ],
    response: authoringTurnHistoryResponseSchema,
  })
  async getOlderAuthoringTurns(
    @Param("courseId") courseId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @Query("beforeRequestId") beforeRequestId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringTurnHistory>> {
    return new BaseResponse(
      await this.sessionService.olderTurns(courseId, sessionId, beforeRequestId, actor),
    );
  }

  @Post("sessions/:sessionId/commands")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
      { type: "body", schema: authoringCommandBodySchema },
    ],
    response: authoringCommandReceiptSchema,
  })
  async sendAuthoringCommand(
    @Param("courseId") courseId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @Body() input: AuthoringCommandBody,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringCommandReceiptResponse>> {
    return new BaseResponse(
      await this.applicationService.command(courseId, sessionId, input, actor),
    );
  }

  @Get("sessions/:sessionId/assets/:assetId")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @ApiProduces("image/png", "image/jpeg", "image/webp", "image/gif")
  @ApiOkResponse({ schema: { type: "string", format: "binary" } })
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
      { type: "param", name: "assetId", schema: UUIDSchema },
      { type: "query", name: "revision", schema: Type.Integer({ minimum: 1 }) },
    ],
  })
  async previewAuthoringAsset(
    @Param("courseId") courseId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @Param("assetId") assetId: UUIDType,
    @Query("revision") revision: number,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<StreamableFile> {
    const asset = await this.sessionService.previewAsset(
      courseId,
      sessionId,
      assetId,
      revision,
      actor,
    );
    return new StreamableFile(asset.bytes, {
      type: asset.mimeType,
      length: asset.bytes.length,
      disposition: "inline",
    });
  }

  @Post("sessions/:sessionId/applications")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
      { type: "body", schema: prepareAuthoringExportSchema },
    ],
    response: authoringApplyStatusSchema,
  })
  async applyAuthoringProposals(
    @Param("courseId") courseId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @Body() input: PrepareAuthoringExportBody,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringApplyStatus>> {
    return new BaseResponse(
      await this.applicationService.enqueue(courseId, sessionId, input, actor),
    );
  }

  @Get("sessions/:sessionId/applications/:exportId")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
      { type: "param", name: "exportId", schema: UUIDSchema },
    ],
    response: authoringApplyStatusSchema,
  })
  async getAuthoringApplication(
    @Param("courseId") courseId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @Param("exportId") exportId: UUIDType,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringApplyStatus>> {
    return new BaseResponse(
      await this.applicationService.status(courseId, sessionId, exportId, actor),
    );
  }

  @Post("sessions/:sessionId/sources")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_COURSE_AUTHORING_SOURCE_SIZE, files: 1 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        commandId: { type: "string", format: "uuid" },
        file: { type: "string", format: "binary" },
      },
      required: ["commandId", "file"],
    },
  })
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
    ],
    response: authoringSourceUploadResponseSchema,
  })
  async uploadAuthoringSource(
    @Param("courseId") courseId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @Body("commandId", new ParseUUIDPipe()) commandId: UUIDType,
    @UploadedFile(
      getBaseFileTypePipe(
        buildFileTypeRegex(COURSE_AUTHORING_SOURCE_FILE_TYPES),
        MAX_COURSE_AUTHORING_SOURCE_SIZE,
        true,
      ).build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringSourceUploadResponse>> {
    return new BaseResponse(
      await this.sessionService.uploadSource(courseId, sessionId, commandId, file, actor),
    );
  }

  @Get("sessions/:sessionId/events")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
      { type: "query", name: "afterSequence", schema: Type.Optional(Type.Integer({ minimum: 0 })) },
    ],
    response: authoringEventsSchema,
  })
  async getAuthoringEvents(
    @Param("courseId") courseId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @Query("afterSequence") afterSequence: number,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringEventsResponse>> {
    return new BaseResponse(
      await this.sessionService.events(courseId, sessionId, afterSequence ?? 0, actor),
    );
  }

  @Get("context")
  @RequirePermission(PERMISSIONS.COURSE_AI_GENERATION)
  @Validate({
    request: [
      { type: "param", name: "courseId", schema: UUIDSchema },
      { type: "query", name: "language", schema: authoringContextQuerySchema.properties.language },
      {
        type: "query",
        name: "lessonIds",
        schema: authoringContextQuerySchema.properties.lessonIds,
      },
    ],
    response: authoringContextResponseSchema,
  })
  async getAuthoringCourseContext(
    @Param("courseId") courseId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @Query("lessonIds") lessonIds: UUIDType[],
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<AuthoringCourseContext>> {
    return new BaseResponse(
      await this.contextService.getContext(courseId, { language, lessonIds }, actor),
    );
  }
}
