import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  PERMISSIONS,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  type BuiltInEmailTemplateKey,
  type SupportedLanguages,
  AUTOMATION_STATUSES,
  type AutomationStatus,
  type AutomationRecipientOptionType,
  type AutomationEventDefinition,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  BaseResponse,
  PaginatedResponse,
  UUIDSchema,
  baseResponse,
  type UUIDType,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { parsePagination } from "src/common/pagination";
import { CurrentUserType } from "src/common/types/current-user.type";

import { AUTOMATION_LIFECYCLE_OPERATIONS } from "./automation.constants";
import { buildAutomationEventCatalogWithSamples } from "./mappers/automation-event-preview.mapper";
import {
  automationSchema,
  automationLanguageQuerySchema,
  automationRecipientOptionTypeSchema,
  paginatedAutomationRecipientOptionSchema,
  type AutomationRecipientOptionResponse,
  deleteAutomationSchema,
  type DeleteAutomationResponse,
  paginatedAutomationSchema,
  createAutomationSchema,
  updateAutomationSchema,
  automationEventSchema,
  automationTemplateSchema,
  automationWorkflowTemplateSchema,
  simulateAutomationSchema,
  automationSimulationSchema,
  type AutomationResponse,
  type CreateAutomationBody,
  type UpdateAutomationBody,
  type SimulateAutomationBody,
  type AutomationSimulationResponse,
  type AutomationTemplateResponse,
  type AutomationWorkflowTemplateResponse,
} from "./schema/automation.schema";
import { AutomationManagementService } from "./services/automation-management.service";
import { AutomationValidationAndSimulationService } from "./services/automation-validation-and-simulation.service";

const languageRequest = {
  type: "query" as const,
  name: "language",
  schema: automationLanguageQuerySchema,
};

const idRequest = { type: "param" as const, name: "id", schema: UUIDSchema };

@Controller("automations")
@RequirePermission(PERMISSIONS.AUTOMATION_MANAGE)
export class AutomationManagementController {
  constructor(
    private readonly automationManagementService: AutomationManagementService,
    private readonly automationValidationAndSimulationService: AutomationValidationAndSimulationService,
  ) {}

  @Get()
  @Validate({
    request: [
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      {
        type: "query",
        name: "perPage",
        schema: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
      },
      { type: "query", name: "search", schema: Type.Optional(Type.String({ maxLength: 200 })) },
      { type: "query", name: "status", schema: Type.Optional(Type.Enum(AUTOMATION_STATUSES)) },
      languageRequest,
    ],
    response: paginatedAutomationSchema,
  })
  async listAutomations(
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
    @Query("search") search?: string,
    @Query("status") status?: AutomationStatus,
    @Query("language") language?: SupportedLanguages,
  ): Promise<PaginatedResponse<AutomationResponse[]>> {
    return new PaginatedResponse(
      await this.automationManagementService.listAutomations({
        ...parsePagination(page, perPage),
        search,
        status,
        language,
      }),
    );
  }

  @Get("recipient-options")
  @Validate({
    request: [
      { type: "query", name: "type", schema: automationRecipientOptionTypeSchema },
      { type: "query", name: "search", schema: Type.Optional(Type.String({ maxLength: 200 })) },
      { type: "query", name: "id", schema: Type.Optional(UUIDSchema) },
      languageRequest,
      { type: "query", name: "page", schema: Type.Optional(Type.Integer({ minimum: 1 })) },
      {
        type: "query",
        name: "perPage",
        schema: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      },
    ],
    response: paginatedAutomationRecipientOptionSchema,
  })
  async listAutomationRecipientOptions(
    @Query("type") type: AutomationRecipientOptionType,
    @Query("search") search: string | undefined,
    @Query("id") id: UUIDType | undefined,
    @Query("language") language: SupportedLanguages | undefined,
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<PaginatedResponse<AutomationRecipientOptionResponse[]>> {
    return new PaginatedResponse(
      await this.automationManagementService.listAutomationRecipientOptions(
        { type, search, id, language, ...parsePagination(page, perPage) },
        user.tenantId,
      ),
    );
  }

  @Get("events")
  @Validate({
    request: [languageRequest],
    response: baseResponse(Type.Array(automationEventSchema)),
  })
  listAutomationEvents(
    @Query("language") language?: SupportedLanguages,
  ): BaseResponse<AutomationEventDefinition[]> {
    return new BaseResponse(buildAutomationEventCatalogWithSamples(language));
  }

  @Get("templates")
  @Validate({
    request: [languageRequest],
    response: baseResponse(Type.Array(automationTemplateSchema)),
  })
  async listAvailableEmailTemplates(
    @Query("language") language?: SupportedLanguages,
  ): Promise<BaseResponse<AutomationTemplateResponse[]>> {
    return new BaseResponse(
      await this.automationValidationAndSimulationService.listPublishedEmailTemplateOptions(
        language,
      ),
    );
  }

  @Get("workflow-templates")
  @Validate({
    request: [languageRequest],
    response: baseResponse(Type.Array(automationWorkflowTemplateSchema)),
  })
  listBuiltInAutomationTemplates(
    @Query("language") language?: SupportedLanguages,
  ): BaseResponse<AutomationWorkflowTemplateResponse[]> {
    return new BaseResponse(
      this.automationManagementService.listBuiltInAutomationTemplates(language),
    );
  }

  @Post("simulate")
  @Validate({
    request: [{ type: "body", schema: simulateAutomationSchema }],
    response: baseResponse(automationSimulationSchema),
  })
  async simulateAutomation(
    @Body() body: SimulateAutomationBody,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AutomationSimulationResponse>> {
    this.automationValidationAndSimulationService.assertJsonSerializableAutomationInput(body);

    return new BaseResponse(
      await this.automationValidationAndSimulationService.simulateAutomation(body, user),
    );
  }

  @Post()
  @Validate({
    request: [{ type: "body", schema: createAutomationSchema }, languageRequest],
    response: baseResponse(automationSchema),
  })
  async createAutomation(
    @Body() body: CreateAutomationBody,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AutomationResponse>> {
    this.automationValidationAndSimulationService.assertJsonSerializableAutomationInput(body);

    return new BaseResponse(
      await this.automationManagementService.createAutomation(body, user, language),
    );
  }

  @Post("from-template/:key")
  @Validate({
    request: [
      { type: "param", name: "key", schema: Type.Enum(BUILT_IN_EMAIL_TEMPLATE_KEYS) },
      languageRequest,
    ],
    response: baseResponse(automationSchema),
  })
  async createAutomationFromTemplate(
    @Param("key") key: BuiltInEmailTemplateKey,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AutomationResponse>> {
    return new BaseResponse(
      await this.automationManagementService.createAutomationFromTemplate(key, user, language),
    );
  }

  @Get(":id")
  @Validate({ request: [idRequest, languageRequest], response: baseResponse(automationSchema) })
  async getAutomation(
    @Param("id") id: UUIDType,
    @Query("language") language?: SupportedLanguages,
  ): Promise<BaseResponse<AutomationResponse>> {
    return new BaseResponse(await this.automationManagementService.getAutomation(id, language));
  }

  @Patch(":id")
  @Validate({
    request: [idRequest, { type: "body", schema: updateAutomationSchema }, languageRequest],
    response: baseResponse(automationSchema),
  })
  async updateAutomation(
    @Param("id") id: UUIDType,
    @Body() body: UpdateAutomationBody,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AutomationResponse>> {
    this.automationValidationAndSimulationService.assertJsonSerializableAutomationInput(body);

    return new BaseResponse(
      await this.automationManagementService.updateAutomation(id, body, user, language),
    );
  }

  @Delete(":id")
  @Validate({ request: [idRequest], response: baseResponse(deleteAutomationSchema) })
  async deleteAutomation(
    @Param("id") id: UUIDType,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<DeleteAutomationResponse>> {
    await this.automationManagementService.deleteAutomation(id, user);

    return new BaseResponse({ id });
  }

  @Post(":id/duplicate")
  @Validate({ request: [idRequest, languageRequest], response: baseResponse(automationSchema) })
  async duplicateAutomation(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AutomationResponse>> {
    return new BaseResponse(
      await this.automationManagementService.duplicateAutomation(id, user, language),
    );
  }

  @Post(":id/apply")
  @Validate({ request: [idRequest, languageRequest], response: baseResponse(automationSchema) })
  async applyAutomation(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AutomationResponse>> {
    return new BaseResponse(
      await this.automationManagementService.changeAutomationLifecycle(
        id,
        AUTOMATION_LIFECYCLE_OPERATIONS.APPLY,
        user,
        language,
      ),
    );
  }

  @Post(":id/enable")
  @Validate({ request: [idRequest, languageRequest], response: baseResponse(automationSchema) })
  async enableAutomation(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AutomationResponse>> {
    return new BaseResponse(
      await this.automationManagementService.changeAutomationLifecycle(
        id,
        AUTOMATION_LIFECYCLE_OPERATIONS.ENABLE,
        user,
        language,
      ),
    );
  }

  @Post(":id/disable")
  @Validate({ request: [idRequest, languageRequest], response: baseResponse(automationSchema) })
  async disableAutomation(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AutomationResponse>> {
    return new BaseResponse(
      await this.automationManagementService.changeAutomationLifecycle(
        id,
        AUTOMATION_LIFECYCLE_OPERATIONS.DISABLE,
        user,
        language,
      ),
    );
  }

  @Post(":id/archive")
  @Validate({ request: [idRequest, languageRequest], response: baseResponse(automationSchema) })
  async archiveAutomation(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BaseResponse<AutomationResponse>> {
    return new BaseResponse(
      await this.automationManagementService.changeAutomationLifecycle(
        id,
        AUTOMATION_LIFECYCLE_OPERATIONS.ARCHIVE,
        user,
        language,
      ),
    );
  }
}
