import { Readable } from "node:stream";

import { COMPETENCIES_MAX_ATTACHMENT_BYTES } from "@mentingo/competencies-sdk";
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Param,
  Res,
  StreamableFile,
  ParseUUIDPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiProduces } from "@nestjs/swagger";
import { PERMISSIONS, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { CompetenciesAssignmentService } from "./competencies-assignment.service";
import { CompetenciesService } from "./competencies.service";
import {
  competencyAssignmentBodySchema,
  type CompetencyAssignmentBody,
  competenciesCommandSchema,
  competenciesConfigurationSchema,
  competenciesWorkspaceSchema,
  competencyCommandResultSchema,
  type CompetenciesCommandBody,
  type CompetenciesConfigurationResponse,
  type CompetenciesWorkspaceResponse,
  type CompetencyCommandResponse,
  competencyRecordsQuerySchema,
  competencyRecordsPageSchema,
  type CompetencyRecordsQueryParams,
  type CompetencyRecordsPageResponse,
} from "./schemas/competencies.schema";

@Controller("competencies")
@UseGuards(PermissionsGuard)
export class CompetenciesController {
  constructor(
    private readonly competenciesService: CompetenciesService,
    private readonly competenciesAssignmentService: CompetenciesAssignmentService,
  ) {}
  @Get("configuration")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({ response: baseResponse(competenciesConfigurationSchema) })
  async getCompetenciesConfiguration(
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetenciesConfigurationResponse>> {
    return new BaseResponse(await this.competenciesService.configuration(actor));
  }

  @Get("workspace")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: [
      { type: "query", name: "language", schema: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)) },
      { type: "query", name: "subjectId", schema: Type.Optional(UUIDSchema) },
      { type: "query", name: "profileId", schema: Type.Optional(UUIDSchema) },
      {
        type: "query",
        name: "teamOnly",
        schema: Type.Optional(Type.Union([Type.Literal("true"), Type.Literal("false")])),
      },
      {
        type: "query",
        name: "view",
        schema: Type.Optional(
          Type.Union([
            Type.Literal("plans"),
            Type.Literal("documents"),
            Type.Literal("summary"),
            Type.Literal("review"),
          ]),
        ),
      },
    ],
    response: baseResponse(competenciesWorkspaceSchema),
  })
  async getCompetenciesWorkspace(
    @Query("language") language: SupportedLanguages | undefined,
    @Query("subjectId") subjectId: string | undefined,
    @Query("profileId") profileId: string | undefined,
    @Query("teamOnly") teamOnly: string | undefined,
    @Query("view") view: "plans" | "documents" | "summary" | "review" | undefined,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetenciesWorkspaceResponse>> {
    return new BaseResponse(
      await this.competenciesService.workspace(
        actor,
        language ?? SUPPORTED_LANGUAGES.EN,
        subjectId,
        profileId,
        teamOnly === "true",
        view,
      ),
    );
  }

  @Get("records")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: Object.entries(competencyRecordsQuerySchema.properties).map(([name, schema]) => ({
      type: "query" as const,
      name,
      schema,
    })),
    response: baseResponse(competencyRecordsPageSchema),
  })
  async getCompetencyRecords(
    @Query("kind") kind: CompetencyRecordsQueryParams["kind"],
    @Query("subjectId") subjectId: string | undefined,
    @Query("actionId") actionId: string | undefined,
    @Query("page") page: string,
    @Query("pageSize") pageSize: CompetencyRecordsQueryParams["pageSize"],
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyRecordsPageResponse>> {
    return new BaseResponse(
      await this.competenciesService.records(actor, { kind, subjectId, actionId, page, pageSize }),
    );
  }

  @Post("commands")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: [{ type: "body", schema: competenciesCommandSchema }],
    response: baseResponse(competencyCommandResultSchema),
  })
  async executeCompetenciesCommand(
    @Body() body: CompetenciesCommandBody,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyCommandResponse>> {
    return new BaseResponse(await this.competenciesService.execute(actor, body));
  }

  @Post("assignments")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE, PERMISSIONS.COURSE_ENROLLMENT)
  @Validate({
    request: [{ type: "body", schema: competencyAssignmentBodySchema }],
    response: baseResponse(competencyCommandResultSchema),
  })
  async assignCompetenciesLearning(
    @Body() body: CompetencyAssignmentBody,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyCommandResponse>> {
    return new BaseResponse(
      await this.competenciesAssignmentService.request(
        actor,
        body.id,
        body.requestId,
        body.subjectId,
      ),
    );
  }

  @Post("attachments")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: COMPETENCIES_MAX_ATTACHMENT_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "subjectId", "competencyId"],
      properties: {
        file: { type: "string", format: "binary" },
        subjectId: { type: "string", format: "uuid" },
        competencyId: { type: "string", format: "uuid" },
      },
    },
  })
  @Validate({
    response: baseResponse(competencyCommandResultSchema),
  })
  async uploadCompetenciesAttachment(
    @Body("subjectId", new ParseUUIDPipe()) subjectId: string,
    @Body("competencyId", new ParseUUIDPipe()) competencyId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyCommandResponse>> {
    return new BaseResponse(
      await this.competenciesService.uploadAttachment(actor, subjectId, competencyId, file),
    );
  }

  @Get("attachments/:id")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @ApiProduces("application/octet-stream")
  @Validate({ request: [{ type: "param", name: "id", schema: UUIDSchema }] })
  async downloadCompetenciesAttachment(
    @Param("id") id: string,
    @CurrentUser() actor: CurrentUserType,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.competenciesService.downloadAttachment(actor, id);
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", file.contentDisposition);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    return new StreamableFile(
      Readable.fromWeb(file.body as import("node:stream/web").ReadableStream),
    );
  }
}
