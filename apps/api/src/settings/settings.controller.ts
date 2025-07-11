import { Controller, Get, Post, Body } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { UUIDType, baseResponse, BaseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";

import {
  CreateSettingsBody,
  settingsJSONContentSchema,
  settingsSchema,
} from "./schemas/settings.schema";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get("")
  async getUserSettings(@CurrentUser("userId") userId: UUIDType) {
    return await this.settingsService.getUserSettings(userId);
  }

  @Public()
  @Post("")
  @Validate({
    request: [{ type: "body", schema: settingsJSONContentSchema }],
    response: baseResponse(settingsSchema),
  })
  async createUserSettings(
    @Body() createSettings: CreateSettingsBody,
    @CurrentUser("userId") userId: UUIDType,
  ) {
    return new BaseResponse(await this.settingsService.createSettings(userId, createSettings));
  }

  // @Patch("")
  // async updateUserSettings(
  //   @CurrentUser("userId") userId: UUIDType,
  //   @Body() updatedSettings: UserSettings,
  // ) {
  //   return await this.settingsService.updateUserSettings(userId, updatedSettings);
  // }
}
