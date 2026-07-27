import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { AutomationStepRecordInput } from "src/announcements/types/automations-source.types";
import { BaseResponse, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";

import { AutomationStepsService } from "./automations-steps.service";

import type { AutomationStepBulkUpdate } from "src/announcements/types/automations-source.types";

@RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
@Controller("automation-steps")
export class AutomationStepsController {
  constructor(private readonly automationStepsService: AutomationStepsService) {}

  @Post()
  async create(@Body() input: AutomationStepRecordInput) {
    const stepId = await this.automationStepsService.createAutomationStep(input);
    return new BaseResponse({ id: stepId });
  }

  @Get(":id")
  async getById(@Param("id") stepId: UUIDType) {
    const step = await this.automationStepsService.getAutomationStepById(stepId);
    return new BaseResponse(step);
  }

  @Get("automation/:automationId")
  async getAll(@Param("automationId") automationId: UUIDType) {
    const steps = await this.automationStepsService.getAllAutomationSteps(automationId);
    return new BaseResponse(steps);
  }

  @Patch(":id")
  async update(@Param("id") stepId: UUIDType, @Body() input: AutomationStepRecordInput) {
    const updatedId = await this.automationStepsService.updateAutomationStep(stepId, input);
    return new BaseResponse({ id: updatedId });
  }

  @Put(":automationId/steps")
  async replaceAutomationStepTree(
    @Param("automationId") automationId: UUIDType,
    @Body() steps: AutomationStepBulkUpdate[],
  ) {
    await this.automationStepsService.ReplaceAutomationStepTree(automationId, steps);
    return new BaseResponse({ message: "Step tree replaced successfully" });
  }

  @Delete(":id")
  async delete(@Param("id") stepId: UUIDType) {
    const deletedId = await this.automationStepsService.deleteAutomationStep(stepId);
    return new BaseResponse({ id: deletedId });
  }
}
