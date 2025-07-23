import { Controller, Get, Body, Patch, UseGuards, Put } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { UUIDType, baseResponse, BaseResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { settingsSchema } from "./schemas/settings.schema";
import { UpdateSettingsBody, updateSettingsBodySchema } from "./schemas/update-settings.schema";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getUserSettings(@CurrentUser("userId") userId: UUIDType) {
    return new BaseResponse(await this.settingsService.getUserSettings(userId));
  }

  @Put()
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

  @Patch("admin-new-user-notification")
  @Roles(USER_ROLES.ADMIN)
  async updateAdminNewUserNotification(@CurrentUser("userId") userId: UUIDType) {
    const result = await this.settingsService.updateAdminNewUserNotification(userId);
    return new BaseResponse(result);
  }
}
