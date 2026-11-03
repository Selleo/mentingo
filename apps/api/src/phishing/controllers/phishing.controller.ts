import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import {
  BaseResponse,
  baseResponse,
  PaginatedResponse,
  paginatedResponse,
  UUIDSchema,
  type UUIDType,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { EnvService } from "src/env/services/env.service";

import {
  createPhishingCampaignSchema,
  phishingAudienceCountSchema,
  phishingAudienceSchema,
  phishingCampaignSchema,
  phishingCampaignsSchema,
  phishingConfigurationSchema,
  phishingLanguageSchema,
  phishingOptionPageSchema,
  phishingOptionQuerySchema,
  phishingOptionsSchema,
  phishingRecipientsSchema,
  phishingReportRecipientsQuerySchema,
  phishingReportSchema,
  phishingScenariosSchema,
  CreatePhishingCampaign,
  PhishingAudience,
} from "../schemas/phishing.schema";
import { PhishingService } from "../services/phishing.service";

import type {
  PhishingAudienceCount,
  PhishingCampaign,
  PhishingCampaigns,
  PhishingConfiguration,
  PhishingOptionPage,
  PhishingOptionQuery,
  PhishingOptions,
  PhishingReport,
  PhishingReportRecipients,
  PhishingReportRecipientsQuery,
  PhishingScenarios,
} from "../schemas/phishing.schema";

@Controller("phishing")
@UseGuards(PermissionsGuard)
export class PhishingController {
  constructor(
    private readonly phishingService: PhishingService,
    private readonly envService: EnvService,
  ) {}

  @Get("configuration")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE, PERMISSIONS.PHISHING_REPORT_READ)
  @Validate({ response: baseResponse(phishingConfigurationSchema) })
  async getPhishingConfiguration(): Promise<BaseResponse<PhishingConfiguration>> {
    return new BaseResponse(await this.envService.getPhishingConfigured());
  }

  @Get("scenarios")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE)
  @Validate({ response: baseResponse(phishingScenariosSchema) })
  async listPhishingScenarios(): Promise<BaseResponse<PhishingScenarios>> {
    return new BaseResponse(await this.phishingService.listScenarios());
  }

  @Get("options")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE)
  @Validate({
    request: [{ type: "query", name: "language", schema: phishingLanguageSchema }],
    response: baseResponse(phishingOptionsSchema),
  })
  async getPhishingOptions(
    @Query("language") language: SupportedLanguages,
  ): Promise<BaseResponse<PhishingOptions>> {
    return new BaseResponse(await this.phishingService.getAllOptions(language));
  }

  @Get("options/search")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE)
  @Validate({
    request: [
      {
        type: "query",
        name: "kind",
        schema: phishingOptionQuerySchema.properties.kind,
        required: true,
      },
      { type: "query", name: "language", schema: phishingLanguageSchema, required: true },
      {
        type: "query",
        name: "page",
        schema: phishingOptionQuerySchema.properties.page,
        required: true,
      },
      { type: "query", name: "search", schema: phishingOptionQuerySchema.properties.search },
    ],
    response: baseResponse(phishingOptionPageSchema),
  })
  async searchPhishingOptions(
    @Query("kind") kind: PhishingOptionQuery["kind"],
    @Query("language") language: SupportedLanguages,
    @Query("page") page: number,
    @Query("search") search?: string,
  ): Promise<BaseResponse<PhishingOptionPage>> {
    return new BaseResponse(
      await this.phishingService.searchOptions({ kind, language, page, search }),
    );
  }

  @Post("audience/count")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE)
  @Validate({
    request: [{ type: "body", schema: phishingAudienceSchema }],
    response: baseResponse(phishingAudienceCountSchema),
  })
  async countPhishingAudience(
    @Body() audience: PhishingAudience,
  ): Promise<BaseResponse<PhishingAudienceCount>> {
    return new BaseResponse(await this.phishingService.countAudience(audience));
  }

  @Get("campaigns")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE, PERMISSIONS.PHISHING_REPORT_READ)
  @Validate({ response: baseResponse(phishingCampaignsSchema) })
  async listPhishingCampaigns(
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<PhishingCampaigns>> {
    return new BaseResponse(await this.phishingService.listVisibleCampaigns(actor));
  }

  @Post("campaigns")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE)
  @Validate({
    request: [{ type: "body", schema: createPhishingCampaignSchema }],
    response: baseResponse(phishingCampaignSchema),
  })
  async createPhishingCampaign(
    @Body() body: CreatePhishingCampaign,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<PhishingCampaign>> {
    return new BaseResponse(await this.phishingService.createCampaign(body, actor));
  }

  @Post("campaigns/:id/cancel")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(phishingCampaignSchema),
  })
  async cancelPhishingCampaign(@Param("id") id: UUIDType): Promise<BaseResponse<PhishingCampaign>> {
    return new BaseResponse(await this.phishingService.cancelCampaign(id));
  }

  @Get("campaigns/:id/report")
  @RequirePermission(PERMISSIONS.PHISHING_REPORT_READ)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: phishingLanguageSchema },
    ],
    response: baseResponse(phishingReportSchema),
  })
  async getPhishingReport(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() actor: CurrentUserType,
  ): Promise<BaseResponse<PhishingReport>> {
    return new BaseResponse(await this.phishingService.getReport(id, actor, language));
  }

  @Get("campaigns/:id/report/recipients")
  @RequirePermission(PERMISSIONS.PHISHING_REPORT_READ)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      {
        type: "query",
        name: "search",
        schema: phishingReportRecipientsQuerySchema.properties.search,
      },
      {
        type: "query",
        name: "groupId",
        schema: phishingReportRecipientsQuerySchema.properties.groupId,
      },
      {
        type: "query",
        name: "filter",
        schema: phishingReportRecipientsQuerySchema.properties.filter,
      },
      { type: "query", name: "sort", schema: phishingReportRecipientsQuerySchema.properties.sort },
      { type: "query", name: "page", schema: phishingReportRecipientsQuerySchema.properties.page },
      {
        type: "query",
        name: "perPage",
        schema: phishingReportRecipientsQuerySchema.properties.perPage,
      },
    ],
    response: paginatedResponse(phishingRecipientsSchema),
  })
  async getPhishingReportRecipients(
    @Param("id") id: UUIDType,
    @Query("search") search: PhishingReportRecipientsQuery["search"],
    @Query("groupId") groupId: PhishingReportRecipientsQuery["groupId"],
    @Query("filter") filter: PhishingReportRecipientsQuery["filter"],
    @Query("sort") sort: PhishingReportRecipientsQuery["sort"],
    @Query("page") page: PhishingReportRecipientsQuery["page"],
    @Query("perPage") perPage: PhishingReportRecipientsQuery["perPage"],
    @CurrentUser() actor: CurrentUserType,
  ): Promise<PaginatedResponse<PhishingReportRecipients>> {
    return new PaginatedResponse(
      await this.phishingService.getReportRecipients(id, actor, {
        search,
        groupId,
        filter,
        sort,
        page,
        perPage,
      }),
    );
  }
}
