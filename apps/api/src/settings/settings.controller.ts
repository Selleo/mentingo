import { Controller, Get, Body, Patch, UseGuards, Put } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { UUIDType, baseResponse, BaseResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

import {
  AdminSettingsJSONContentSchema,
  adminSettingsJSONContentSchema,
  companyInformationJSONSchema,
  GlobalSettingsJSONContentSchema,
  globalSettingsJSONSchema,
  settingsJSONContentSchema,
  UserSettingsJSONContentSchema,
  userSettingsJSONContentSchema,
} from "./schemas/settings.schema";
import { UpdateSettingsBody, updateSettingsBodySchema } from "./schemas/update-settings.schema";
import { SettingsService } from "./settings.service";
import { Public } from "src/common/decorators/public.decorator";
import { CompanyInformaitonJSONSchema } from "./schemas/company-information.schema";

@Controller("settings")
@UseGuards(RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get("global")
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async getPublicGlobalSettings(): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    return new BaseResponse(await this.settingsService.getGlobalSettings());
  }

  @Get()
  @Validate({
    response: baseResponse(userSettingsJSONContentSchema),
  })
  async getUserSettings(
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<UserSettingsJSONContentSchema>> {
    return new BaseResponse(await this.settingsService.getUserSettings(userId));
  }

  @Put()
  @Validate({
    request: [{ type: "body", schema: updateSettingsBodySchema }],
    response: baseResponse(settingsJSONContentSchema),
  })
  async updateUserSettings(
    @Body() updatedSettings: UpdateSettingsBody,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<UserSettingsJSONContentSchema>> {
    return new BaseResponse(await this.settingsService.updateUserSettings(userId, updatedSettings));
  }

  @Patch("admin/new-user-notification")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(adminSettingsJSONContentSchema),
  })
  async updateAdminNewUserNotification(
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<AdminSettingsJSONContentSchema>> {
    const result = await this.settingsService.updateAdminNewUserNotification(userId);
    return new BaseResponse(result);
  }

  @Patch("admin/unregistered-user-courses-accessibility")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async updateUnregisteredUserCoursesAccessibility(): Promise<
    BaseResponse<GlobalSettingsJSONContentSchema>
  > {
    const result = await this.settingsService.updateGlobalUnregisteredUserCoursesAccessibility();
    return new BaseResponse(result);
  }

  @Get("company-information")
  @Public()
  @Validate({
    request: [{ type: "body", schema: companyInformationJSONSchema }],
    response: baseResponse(companyInformationJSONSchema),
  })
  async getCompanyInformation() {
    const result = await this.settingsService.getCompanyInformation();
    return new BaseResponse(result);
  }

  @Patch("company-information")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: companyInformationJSONSchema }],
    response: baseResponse(companyInformationJSONSchema),
  })
  async updateCompanyInformation(@Body() companyInfo: CompanyInformaitonJSONSchema) {
    return new BaseResponse(await this.settingsService.updateCompanyInformation(companyInfo));
  }
}
