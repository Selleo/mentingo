import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { AutomationStepRecordInput } from "src/announcements/types/automations-source.types";
import { BaseResponse, baseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";

import {
  automationIdResponseSchema,
  automationStepBulkUpdateSchema,
  automationStepInputSchema,
  automationStepSchema,
} from "../schemas/automation.schema";

import { AutomationStepsService } from "./automations-steps.service";

import type { AutomationStepBulkUpdate } from "src/announcements/types/automations-source.types";

@RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
@Controller("automation-steps")
export class AutomationStepsController {
  constructor(private readonly automationStepsService: AutomationStepsService) {}

  @Post()
  @Validate({
    request: [{ type: "body", schema: automationStepInputSchema }],
    response: automationIdResponseSchema,
  })
  async create(@Body() input: AutomationStepRecordInput) {
    const stepId = await this.automationStepsService.createAutomationStep(input);
    return new BaseResponse({ id: stepId });
  }

  @Get("automation/:automationId")
  @Validate({
    request: [{ type: "param", name: "automationId", schema: UUIDSchema }],
    response: baseResponse(Type.Array(automationStepSchema)),
  })
  async getAll(@Param("automationId") automationId: UUIDType) {
    const steps = await this.automationStepsService.getAllAutomationSteps(automationId);
    return new BaseResponse(steps);
  }

  @Get(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(automationStepSchema),
  })
  async getById(@Param("id") stepId: UUIDType) {
    const step = await this.automationStepsService.getAutomationStepById(stepId);
    return new BaseResponse(step);
  }

  @Patch(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: automationStepInputSchema },
    ],
    response: automationIdResponseSchema,
  })
  async update(@Param("id") stepId: UUIDType, @Body() input: AutomationStepRecordInput) {
    const updatedId = await this.automationStepsService.updateAutomationStep(stepId, input);
    return new BaseResponse({ id: updatedId });
  }

  @Put(":automationId/steps")
  @Validate({
    request: [
      { type: "param", name: "automationId", schema: UUIDSchema },
      { type: "body", schema: Type.Array(automationStepBulkUpdateSchema) },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async replaceAutomationStepTree(
    @Param("automationId") automationId: UUIDType,
    @Body() steps: AutomationStepBulkUpdate[],
  ) {
    await this.automationStepsService.replaceAutomationStepTree(automationId, steps);
    return new BaseResponse({ message: "Step tree replaced successfully" });
  }

  @Delete(":id")
  @Validate({ request: [{ type: "param", name: "id", schema: UUIDSchema }] })
  async delete(@Param("id") stepId: UUIDType) {
    const deletedId = await this.automationStepsService.deleteAutomationStep(stepId);
    return new BaseResponse({ id: deletedId });
  }
}
