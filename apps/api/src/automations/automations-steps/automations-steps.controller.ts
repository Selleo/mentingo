import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";

import { AutomationStepRecordInput } from "src/announcements/types/automations-source.types";
import { UUIDType } from "src/common";

import { AutomationStepsService } from "./automations-steps.service";

import type { AutomationStepBulkUpdate } from "src/announcements/types/automations-source.types";

@Controller("automation-steps")
export class AutomationStepsController {
  constructor(private readonly automationStepsService: AutomationStepsService) {}

  @Post()
  async create(@Body() input: AutomationStepRecordInput) {
    return this.automationStepsService.createAutomationStep(input);
  }

  @Get(":id")
  async getById(@Param("id") stepId: UUIDType) {
    return this.automationStepsService.getAutomationStepById(stepId);
  }

  @Get("automation/:automationId")
  async getAll(@Param("automationId") automationId: UUIDType) {
    return this.automationStepsService.getAllAutomationSteps(automationId);
  }

  @Patch(":id")
  async update(@Param("id") stepId: UUIDType, @Body() input: AutomationStepRecordInput) {
    return this.automationStepsService.updateAutomationStep(stepId, input);
  }
  @Put(":automationId/steps")
  async replaceAutomationStepTree(
    @Param("automationId") automationId: UUIDType,
    @Body() steps: AutomationStepBulkUpdate[],
  ) {
    return this.automationStepsService.ReplaceAutomationStepTree(automationId, steps);
  }
  @Delete(":id")
  async delete(@Param("id") stepId: UUIDType) {
    return this.automationStepsService.deleteAutomationStep(stepId);
  }
}
