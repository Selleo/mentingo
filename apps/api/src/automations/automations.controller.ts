import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  AutomationRecordInput,
  AutomationRecordUpdateInput,
} from "src/announcements/types/automations-source.types";
import { BaseResponse, baseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";

import { AutomationSimulationService } from "./automation-runner/automation-simulation.service";
import { RunSimulationBody } from "./automation-runner/automation-simulation.types";
import { AutomationSystemTemplatePreviewService } from "./automation-runner/automation-system-template-preview.service";
import { AutomationsSeedDefaultsService } from "./automations-seed-defaults.service";
import { AutomationsService } from "./automations.service";
import {
  automationCreateSchema,
  automationIdResponseSchema,
  automationRecordSchema,
  automationSaveResponseSchema,
  automationSaveSchema,
  automationStatusSchema,
  automationUpdateSchema,
  runSimulationSchema,
  simulationResultSchema,
} from "./schemas/automation.schema";

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
  @Validate({ response: baseResponse(Type.Array(automationRecordSchema)) })
  async getAllAutomations(@CurrentUser("tenantId") tenantId: UUIDType) {
    const automations = await this.automationsService.getAllAutomations(tenantId);
    return new BaseResponse(automations);
  }

  @Get("system-template-preview/:templateId")
  @Validate({
    request: [
      { type: "param", name: "templateId", schema: Type.String({ minLength: 1 }) },
      { type: "query", name: "language", schema: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)) },
    ],
    response: baseResponse(Type.Object({ subject: Type.String(), html: Type.String() })),
  })
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
  @Validate({
    request: [{ type: "body", schema: runSimulationSchema }],
    response: baseResponse(simulationResultSchema),
  })
  async runSimulation(@Body() body: RunSimulationBody) {
    const result = await this.simulationService.runSimulation(body);
    return new BaseResponse(result);
  }

  @Post("seed-defaults")
  @Validate({
    request: [
      {
        type: "body",
        schema: Type.Optional(Type.Object({ language: Type.Enum(SUPPORTED_LANGUAGES) })),
      },
    ],
    response: baseResponse(
      Type.Object({
        created: Type.Number(),
        skipped: Type.Number(),
        failed: Type.Number(),
        total: Type.Number(),
      }),
    ),
  })
  async seedDefaults(
    @Body() body: { language?: SupportedLanguages },
    @CurrentUser("tenantId") tenantId: UUIDType,
  ) {
    const language = body?.language ?? SUPPORTED_LANGUAGES.EN;
    const result = await this.seedDefaultsService.seedDefaults(tenantId, language);
    return new BaseResponse(result);
  }

  @Get(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(automationRecordSchema),
  })
  async getAutomationById(@Param("id") automationId: UUIDType) {
    const automation = await this.automationsService.getAutomationById(automationId);
    return new BaseResponse(automation);
  }

  @Post()
  @Validate({
    request: [{ type: "body", schema: automationCreateSchema }],
    response: baseResponse(automationRecordSchema),
  })
  async createAutomation(@Body() input: AutomationRecordInput) {
    const automation = await this.automationsService.createAutomation(input);
    return new BaseResponse(automation);
  }

  @Patch("status/:id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: automationStatusSchema },
    ],
    response: automationIdResponseSchema,
  })
  async updateStatus(
    @Param("id") automationId: UUIDType,
    @Body() body: { status: AutomationStatus },
  ) {
    const updatedId = await this.automationsService.updateStatus(automationId, body.status);
    return new BaseResponse({ id: updatedId });
  }

  @Patch(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: automationUpdateSchema },
    ],
    response: automationIdResponseSchema,
  })
  async updateAutomation(
    @Param("id") automationId: UUIDType,
    @Body() input: AutomationRecordUpdateInput,
  ) {
    const updatedId = await this.automationsService.updateAutomation(automationId, input);
    return new BaseResponse({ id: updatedId });
  }

  @Delete(":id")
  @Validate({ request: [{ type: "param", name: "id", schema: UUIDSchema }] })
  async deleteAutomation(@Param("id") automationId: UUIDType) {
    const deleted = await this.automationsService.deleteAutomation(automationId);
    return new BaseResponse(deleted);
  }

  @Patch(":id/save")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: automationSaveSchema },
    ],
    response: automationSaveResponseSchema,
  })
  async saveAutomation(
    @Param("id") automationId: UUIDType,
    @Body() body: Static<typeof automationSaveSchema>,
  ) {
    const result = await this.automationsService.saveAutomation(
      automationId,
      body.metadata,
      body.steps,
    );
    return new BaseResponse(result);
  }
}
