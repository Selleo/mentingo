import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { BaseResponse } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { DisallowInSupportModeGuard } from "src/common/guards/disallow-support-mode.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { DashboardService } from "./dashboard.service";
import {
  dashboardLayoutResponseSchema,
  updateDashboardLayoutBodySchema,
  UpdateDashboardLayoutBody,
} from "./schemas/dashboard-layout.schema";

import type { DashboardLayoutWidgetSchema } from "./schemas/dashboard-layout.schema";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("layout")
  @Validate({
    response: dashboardLayoutResponseSchema,
  })
  async getLayout(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DashboardLayoutWidgetSchema[]>> {
    return new BaseResponse(await this.dashboardService.getLayout(currentUser));
  }

  @Put("layout")
  @UseGuards(DisallowInSupportModeGuard)
  @Validate({
    request: [{ type: "body", schema: updateDashboardLayoutBodySchema }],
    response: dashboardLayoutResponseSchema,
  })
  async replaceLayout(
    @Body() { widgets }: UpdateDashboardLayoutBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<DashboardLayoutWidgetSchema[]>> {
    return new BaseResponse(await this.dashboardService.replaceLayout(currentUser, widgets));
  }
}
