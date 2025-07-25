import { Controller, Get, Body, Patch, UseGuards, Put } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { UUIDType, baseResponse, BaseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

import {
  globalSettingsJSONContentSchema,
  settingsJSONContentSchema,
  type SettingsResponse,
} from "./schemas/settings.schema";
import {
  UpdateGlobalSettingsBody,
  updateGlobalSettingsBodySchema,
  UpdateSettingsBody,
  updateSettingsBodySchema,
} from "./schemas/update-settings.schema";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Validate({
    response: baseResponse(settingsJSONContentSchema),
  })
  async getUserSettings(
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<SettingsResponse>> {
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
  ): Promise<BaseResponse<SettingsResponse>> {
    return new BaseResponse(await this.settingsService.updateUserSettings(userId, updatedSettings));
  }

  @Patch("admin-new-user-notification")
  @Roles(USER_ROLES.ADMIN)
  async updateAdminNewUserNotification(
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<SettingsResponse>> {
    const result = await this.settingsService.updateAdminNewUserNotification(userId);
    return new BaseResponse(result);
  }

  @Get("global")
  @Public()
  @Validate({
    response: baseResponse(globalSettingsJSONContentSchema),
  })
  async getGlobalSettings() {
    const settings = await this.settingsService.getGlobalSettings();
    return new BaseResponse(settings);
  }

  @Patch("global")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: updateGlobalSettingsBodySchema }],
    response: baseResponse(globalSettingsJSONContentSchema),
  })
  async updateGlobalSettings(@Body() updatedSettings: UpdateGlobalSettingsBody) {
    const settings = await this.settingsService.updateGlobalSettings(updatedSettings);
    return new BaseResponse(settings);
  }
}
