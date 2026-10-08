import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PERMISSIONS, SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { EnvService } from "src/env/services/env.service";

import {
  CreatePhishingCampaign,
  createPhishingCampaignSchema,
  phishingCampaignSchema,
  phishingConfigurationSchema,
  phishingLanguageSchema,
  phishingOptionsSchema,
  phishingReportSchema,
  phishingScenarioSchema,
} from "./phishing.schema";
import { PhishingService } from "./phishing.service";
@Controller("phishing")
@UseGuards(PermissionsGuard)
export class PhishingController {
  constructor(
    private readonly service: PhishingService,
    private readonly env: EnvService,
  ) {}
  @Get("configuration")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE, PERMISSIONS.PHISHING_REPORT_READ)
  @Validate({ response: baseResponse(phishingConfigurationSchema) })
  async getPhishingConfiguration() {
    return new BaseResponse(await this.env.getPhishingConfigured());
  }
  @Get("scenarios")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE)
  @Validate({ response: baseResponse(Type.Array(phishingScenarioSchema)) })
  async listPhishingScenarios() {
    return new BaseResponse(await this.service.scenarios());
  }
  @Get("options")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE)
  @Validate({
    request: [{ type: "query", name: "language", schema: phishingLanguageSchema }],
    response: baseResponse(phishingOptionsSchema),
  })
  async getPhishingOptions(@Query("language") language: SupportedLanguages) {
    return new BaseResponse(await this.service.options(language));
  }
  @Get("campaigns")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE, PERMISSIONS.PHISHING_REPORT_READ)
  @Validate({ response: baseResponse(Type.Array(phishingCampaignSchema)) })
  async listPhishingCampaigns(@CurrentUser() actor: CurrentUserType) {
    return new BaseResponse(await this.service.list(actor));
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
  ) {
    return new BaseResponse(await this.service.create(body, actor));
  }
  @Post("campaigns/:id/cancel")
  @RequirePermission(PERMISSIONS.PHISHING_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(phishingCampaignSchema),
  })
  async cancelPhishingCampaign(@Param("id") id: string) {
    return new BaseResponse(await this.service.cancel(id));
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
    @Param("id") id: string,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return new BaseResponse(await this.service.report(id, actor, language));
  }
}
