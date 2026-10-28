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
import { PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { CompetenciesService } from "./competencies.service";
import {
  competenciesCommandSchema,
  competenciesConfigurationSchema,
  competenciesSummarySchema,
  competencyCatalogPageSchema,
  competencyCatalogQuerySchema,
  competencyCategoriesPageSchema,
  competencyCategoriesQuerySchema,
  competencyCommandResultSchema,
  competencyDocumentsPageSchema,
  competencyDocumentsQuerySchema,
  competencyMatrixPageSchema,
  competencyMatrixQuerySchema,
  competencyOptionsQuerySchema,
  competencyOptionsSchema,
  competencyPeoplePageSchema,
  competencyPeopleQuerySchema,
  competencyProfilesPageSchema,
  competencyProfilesQuerySchema,
  competencyReviewsPageSchema,
  competencyReviewsQuerySchema,
  competencySubjectQuerySchema,
  competencySubjectSchema,
  type CompetenciesCommandBody,
  type CompetenciesConfigurationResponse,
  type CompetenciesSummaryResponse,
  type CompetencyCatalogPageResponse,
  type CompetencyCatalogQuery,
  type CompetencyCategoriesPageResponse,
  type CompetencyCommandResponse,
  type CompetencyDocumentsPageResponse,
  type CompetencyMatrixPageResponse,
  type CompetencyMatrixQuery,
  type CompetencyOptionsQuery,
  type CompetencyOptionsResponse,
  type CompetencyPeoplePageResponse,
  type CompetencyPeopleQuery,
  type CompetencyProfilesPageResponse,
  type CompetencyReviewsPageResponse,
  type CompetencyReviewsQuery,
  type CompetencySubjectResponse,
} from "./schemas/competencies.schema";
import { queryParameters } from "./utils/competencies-query-parameters.utils";

@Controller("competencies")
@UseGuards(PermissionsGuard)
export class CompetenciesController {
  constructor(private readonly competenciesService: CompetenciesService) {}

  @Get("configuration")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({ response: baseResponse(competenciesConfigurationSchema) })
  async getCompetenciesConfiguration(
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetenciesConfigurationResponse>> {
    return new BaseResponse(await this.competenciesService.getConfiguration(actor));
  }

  @Get("summary")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({ response: baseResponse(competenciesSummarySchema) })
  async getCompetenciesSummary(
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetenciesSummaryResponse>> {
    return new BaseResponse(await this.competenciesService.getSummary(actor));
  }

  @Get("categories")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: queryParameters(competencyCategoriesQuerySchema),
    response: baseResponse(competencyCategoriesPageSchema),
  })
  async getCompetencyCategories(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("search") search: string | undefined,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyCategoriesPageResponse>> {
    return new BaseResponse(
      await this.competenciesService.getCategories(actor, { page, perPage, search }),
    );
  }

  @Get("catalog")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: queryParameters(competencyCatalogQuerySchema),
    response: baseResponse(competencyCatalogPageSchema),
  })
  async getCompetencyCatalog(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("search") search: string | undefined,
    @Query("categoryId") categoryId: CompetencyCatalogQuery["categoryId"],
    @Query("archived") archived: CompetencyCatalogQuery["archived"],
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyCatalogPageResponse>> {
    return new BaseResponse(
      await this.competenciesService.getCatalog(actor, {
        page,
        perPage,
        search,
        categoryId,
        archived,
      }),
    );
  }

  @Get("profiles")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: queryParameters(competencyProfilesQuerySchema),
    response: baseResponse(competencyProfilesPageSchema),
  })
  async getCompetencyProfiles(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("search") search: string | undefined,
    @Query("competencyId") competencyId: string | undefined,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyProfilesPageResponse>> {
    return new BaseResponse(
      await this.competenciesService.getProfiles(actor, { page, perPage, search, competencyId }),
    );
  }

  @Get("people")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: queryParameters(competencyPeopleQuerySchema),
    response: baseResponse(competencyPeoplePageSchema),
  })
  async getCompetencyPeople(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("search") search: string | undefined,
    @Query("profileId") profileId: string | undefined,
    @Query("readiness") readiness: CompetencyPeopleQuery["readiness"],
    @Query("teamOnly") teamOnly: CompetencyPeopleQuery["teamOnly"],
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyPeoplePageResponse>> {
    return new BaseResponse(
      await this.competenciesService.getPeople(actor, {
        page,
        perPage,
        search,
        profileId,
        readiness,
        teamOnly,
      }),
    );
  }

  @Get("matrix")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: queryParameters(competencyMatrixQuerySchema),
    response: baseResponse(competencyMatrixPageSchema),
  })
  async getCompetencyMatrix(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("search") search: string | undefined,
    @Query("profileId") profileId: string,
    @Query("teamOnly") teamOnly: CompetencyMatrixQuery["teamOnly"],
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyMatrixPageResponse>> {
    return new BaseResponse(
      await this.competenciesService.getMatrix(actor, {
        page,
        perPage,
        search,
        profileId,
        teamOnly,
      }),
    );
  }

  @Get("reviews")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: queryParameters(competencyReviewsQuerySchema),
    response: baseResponse(competencyReviewsPageSchema),
  })
  async getCompetencyReviews(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("search") search: string | undefined,
    @Query("status") status: CompetencyReviewsQuery["status"],
    @Query("competencyId") competencyId: string | undefined,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyReviewsPageResponse>> {
    return new BaseResponse(
      await this.competenciesService.getReviews(actor, {
        page,
        perPage,
        search,
        status,
        competencyId,
      }),
    );
  }

  @Get("options")
  @RequirePermission(PERMISSIONS.COMPETENCIES_MANAGE)
  @Validate({
    request: queryParameters(competencyOptionsQuerySchema),
    response: baseResponse(competencyOptionsSchema),
  })
  async getCompetencyOptions(
    @Query("language") language: CompetencyOptionsQuery["language"],
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyOptionsResponse>> {
    return new BaseResponse(
      await this.competenciesService.getDefinitionOptions(
        actor,
        language ?? SUPPORTED_LANGUAGES.EN,
      ),
    );
  }

  @Get("subjects/:subjectId")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: [
      { type: "param", name: "subjectId", schema: UUIDSchema },
      ...queryParameters(competencySubjectQuerySchema),
    ],
    response: baseResponse(competencySubjectSchema),
  })
  async getCompetencySubject(
    @Param("subjectId") subjectId: string,
    @Query("profileId") profileId: string | undefined,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencySubjectResponse>> {
    return new BaseResponse(
      await this.competenciesService.getSubjectCompetencies(actor, subjectId, { profileId }),
    );
  }

  @Get("subjects/:subjectId/documents")
  @RequirePermission(PERMISSIONS.COMPETENCIES_USE)
  @Validate({
    request: [
      { type: "param", name: "subjectId", schema: UUIDSchema },
      ...queryParameters(competencyDocumentsQuerySchema),
    ],
    response: baseResponse(competencyDocumentsPageSchema),
  })
  async getCompetencySubjectDocuments(
    @Param("subjectId") subjectId: string,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<CompetencyDocumentsPageResponse>> {
    return new BaseResponse(
      await this.competenciesService.getSubjectDocuments(actor, subjectId, { page, perPage }),
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
    return new BaseResponse(await this.competenciesService.executeCompetenciesCommand(actor, body));
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
