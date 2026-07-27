import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import {
  AutomationRecordInput,
  AutomationRecordUpdateInput,
} from "src/announcements/types/automations-source.types";
import { BaseResponse, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";

import { AutomationsService } from "./automations.service";

import type { AutomationStatus } from "src/announcements/types/automations.types";

@RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
@Controller("automations")
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  async getAllAutomations(@CurrentUser("tenantId") tenantId: UUIDType) {
    const automations = await this.automationsService.getAllAutomations(tenantId);
    return new BaseResponse(automations);
  }

  @Get(":id")
  async getAutomationById(@Param("id") automationId: UUIDType) {
    const automation = await this.automationsService.getAutomationById(automationId);
    return new BaseResponse(automation);
  }

  @Post()
  async createAutomation(@Body() input: AutomationRecordInput) {
    const automation = await this.automationsService.createAutomation(input);
    return new BaseResponse(automation);
  }

  @Patch("status/:id")
  async updateStatus(
    @Param("id") automationId: UUIDType,
    @Body() body: { status: AutomationStatus },
  ) {
    const updatedId = await this.automationsService.updateStatus(automationId, body.status);
    return new BaseResponse({ id: updatedId });
  }

  @Patch(":id")
  async updateAutomation(
    @Param("id") automationId: UUIDType,
    @Body() input: AutomationRecordUpdateInput,
  ) {
    const updatedId = await this.automationsService.updateAutomation(automationId, input);
    return new BaseResponse({ id: updatedId });
  }

  @Delete(":id")
  async deleteAutomation(@Param("id") automationId: UUIDType) {
    const deleted = await this.automationsService.deleteAutomation(automationId);
    return new BaseResponse(deleted);
  }
}
