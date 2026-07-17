import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";

import { AutomationRecordInput } from "src/announcements/types/automations-source.types";
import { UUIDType } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";

import { AutomationsService } from "./automations.service";

import type { AutomationStatus } from "src/announcements/types/automations.types";

@Controller("automations")
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get("tenant/:tenantId")
  async getAllAutomations(@CurrentUser("tenantId") tenantId: UUIDType) {
    return this.automationsService.getAllAutomations(tenantId);
  }

  @Get(":id")
  async getAutomationById(@Param("id") automationId: UUIDType) {
    return this.automationsService.getAutomationById(automationId);
  }

  @Post()
  async createAutomation(@Body() input: AutomationRecordInput) {
    return this.automationsService.createAutomation(input);
  }

  @Patch("status/:id")
  async updateStatus(
    @Param("id") automationId: UUIDType,
    @Body() body: { status: AutomationStatus },
  ) {
    return this.automationsService.updateStatus(automationId, body.status);
  }

  @Patch(":id")
  async updateAutomation(
    @Param("id") automationId: UUIDType,
    @Body() input: AutomationRecordInput,
  ) {
    return this.automationsService.updateAutomation(automationId, input);
  }

  @Delete(":id")
  async deleteAutomation(@Param("id") automationId: UUIDType) {
    return this.automationsService.deleteAutomation(automationId);
  }
}
