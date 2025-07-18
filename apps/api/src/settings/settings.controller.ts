import { Controller, Get, Post, Body, Patch, UseGuards } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { UUIDType, baseResponse, BaseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

import {
  CompanyInformationBody,
  companyInformationBodySchema,
} from "./schemas/company-information.schema";
import { CreateSettingsBody, createSettingsBodySchema } from "./schemas/create-settings.schema";
import { settingsSchema, globalSettingsSchema } from "./schemas/settings.schema";
import { UpdateSettingsBody, updateSettingsBodySchema } from "./schemas/update-settings.schema";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("")
  async getUserSettings(@CurrentUser("userId") userId: UUIDType) {
    return await this.settingsService.getUserSettings(userId);
  }

  @Post("")
  @Validate({
    request: [{ type: "body", schema: createSettingsBodySchema }],
    response: baseResponse(settingsSchema),
  })
  async createUserSettings(
    @Body() createSettings: CreateSettingsBody,
    @CurrentUser("userId") userId: UUIDType,
  ) {
    return new BaseResponse(await this.settingsService.createSettings(userId, createSettings));
  }

  @Patch("")
  @Validate({
    request: [{ type: "body", schema: updateSettingsBodySchema }],
    response: baseResponse(settingsSchema),
  })
  async updateUserSettings(
    @Body() updatedSettings: UpdateSettingsBody,
    @CurrentUser("userId") userId: UUIDType,
  ) {
    return new BaseResponse(await this.settingsService.updateUserSettings(userId, updatedSettings));
  }

  @Get("company-information")
  @Public()
  async getCompanyInformation() {
    return await this.settingsService.getCompanyInformation();
  }

  @Post("company-information")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: companyInformationBodySchema }],
    response: baseResponse(globalSettingsSchema),
  })
  async createCompanyInformation(@Body() companyInfo: CompanyInformationBody) {
    return new BaseResponse(await this.settingsService.createCompanyInformation(companyInfo));
  }

  @Patch("company-information")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: companyInformationBodySchema }],
    response: baseResponse(globalSettingsSchema),
  })
  async updateCompanyInformation(@Body() companyInfo: CompanyInformationBody) {
    return new BaseResponse(await this.settingsService.updateCompanyInformation(companyInfo));
  }
}
