import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES, SupportedLanguages } from "@repo/shared";

import {
  AutomationRecordInput,
  AutomationRecordUpdateInput,
} from "src/announcements/types/automations-source.types";
import { BaseResponse, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";

import { AutomationSimulationService } from "./automation-runner/automation-simulation.service";
import { RunSimulationBody } from "./automation-runner/automation-simulation.types";
import { AutomationSystemTemplatePreviewService } from "./automation-runner/automation-system-template-preview.service";
import { AutomationsSeedDefaultsService } from "./automations-seed-defaults.service";
import { AutomationsService } from "./automations.service";

import type { AutomationStatus } from "src/announcements/types/automations.types";

@RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
@Controller("automations")
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly systemTemplatePreviewService: AutomationSystemTemplatePreviewService,
    private readonly simulationService: AutomationSimulationService,
    private readonly seedDefaultsService: AutomationsSeedDefaultsService,
  ) {}

  @Get()
  async getAllAutomations(@CurrentUser("tenantId") tenantId: UUIDType) {
    const automations = await this.automationsService.getAllAutomations(tenantId);
    return new BaseResponse(automations);
  }

  @Get("system-template-preview/:templateId")
  async previewSystemTemplate(
    @Param("templateId") templateId: string,
    @Query("language") language?: SupportedLanguages,
  ) {
    const resolvedLanguage = language ?? SUPPORTED_LANGUAGES.PL;
    const preview = await this.systemTemplatePreviewService.renderPreview(
      templateId,
      resolvedLanguage,
    );

    return new BaseResponse(preview ?? { subject: "", html: "" });
  }

  @Post("simulate")
  async runSimulation(@Body() body: RunSimulationBody) {
    const result = await this.simulationService.runSimulation(body);
    return new BaseResponse(result);
  }

  @Post("seed-defaults")
  async seedDefaults(
    @CurrentUser("tenantId") tenantId: UUIDType,
    @Body() body?: { language?: SupportedLanguages },
  ) {
    const language = body?.language ?? SUPPORTED_LANGUAGES.EN;
    const result = await this.seedDefaultsService.seedDefaults(tenantId, language);
    return new BaseResponse(result);
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
