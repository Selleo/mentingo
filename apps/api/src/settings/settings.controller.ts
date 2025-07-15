import { Controller, Get, Post, Body, Patch } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { UUIDType, baseResponse, BaseResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { CreateSettingsBody, createSettingsBodySchema } from "./schemas/create-settings.schema";
import { settingsSchema } from "./schemas/settings.schema";
import { UpdateSettingsBody, updateSettingsBodySchema } from "./schemas/update-settings.schema";
import { SettingsService } from "./settings.service";

@Controller("settings")
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

  @Roles(USER_ROLES.ADMIN)
  @Patch("admin-new-user-notification")
  async updateAdminNewUserNotification(@CurrentUser("userId") userId: UUIDType) {
    return new BaseResponse(await this.settingsService.updateAdminNewUserNotification(userId));
  }
}
