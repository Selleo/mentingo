import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AUTOMATION_STATUSES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
  type BuiltInEmailTemplateKey,
  ACTIVITY_LOG_ACTION_TYPES,
  ACTIVITY_LOG_RESOURCE_TYPES,
  duplicateAutomationWorkflow,
  getAutomationWorkflowIssues,
  type ActivityLogActionType,
  type AutomationListQuery,
  type AutomationRecipientOptionsQuery,
} from "@repo/shared";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { BUILT_IN_AUTOMATIONS } from "src/automation-execution/catalog";
import { buildBuiltInAutomationDefinition } from "src/automation-execution/mappers/builtin-automation.mapper";
import { acquireAutomationLifecycleLock } from "src/automation-execution/utils/acquire-automation-lifecycle-lock";
import {
  AUTOMATION_RUNTIME,
  AUTOMATION_LIFECYCLE_OPERATIONS,
  AUTOMATION_LIFECYCLE_TARGET_STATUSES,
  AUTOMATION_LIFECYCLE_ACTIVITY_TYPES,
} from "src/automations/automation.constants";
import { LocalizationService } from "src/localization/localization.service";

import { AutomationRuntime } from "../automation.types";
import { AutomationRecipientOptionsRepository } from "../repositories/automation-recipient-options.repository";

import { AutomationDefinitionStorageService } from "./automation-definition-storage.service";
import { AutomationValidationAndSimulationService } from "./automation-validation-and-simulation.service";

import type { AutomationLifecycleOperation, AutomationRecord } from "../automation.types";
import type {
  AutomationResponse,
  AutomationWorkflowTemplateResponse,
  CreateAutomationBody,
  UpdateAutomationBody,
} from "../schema/automation.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AutomationManagementService {
  constructor(
    private readonly automationDefinitionStorageService: AutomationDefinitionStorageService,
    private readonly automationRecipientOptionsRepository: AutomationRecipientOptionsRepository,
    private readonly automationValidationAndSimulationService: AutomationValidationAndSimulationService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly localizationService: LocalizationService,
    @Inject(AUTOMATION_RUNTIME) private readonly automationRuntime: AutomationRuntime,
  ) {}

  async listAutomationRecipientOptions(query: AutomationRecipientOptionsQuery, tenantId: UUIDType) {
    const { rows, pagination } =
      await this.automationRecipientOptionsRepository.findAutomationRecipientOptionsPage(
        query,
        tenantId,
      );

    return { data: rows, pagination };
  }

  async listAutomations(query: AutomationListQuery) {
    const result = await this.automationDefinitionStorageService.listAutomations(query);

    return { ...result, data: result.data.map((record) => this.mapAutomationResponse(record)) };
  }

  async getAutomation(id: UUIDType, language?: SupportedLanguages) {
    return this.mapAutomationResponse(
      await this.automationDefinitionStorageService.getAutomation(id, undefined, false, language),
    );
  }

  listBuiltInAutomationTemplates(
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ): AutomationWorkflowTemplateResponse[] {
    return BUILT_IN_AUTOMATIONS.map((builtin) => ({
      key: builtin.templateKey,
      definition: buildBuiltInAutomationDefinition(builtin, undefined, {
        name: this.localizationService.getLocalizedValue(
          builtin.name,
          language,
          SUPPORTED_LANGUAGES.EN,
        )!,
        description: this.localizationService.getLocalizedValue(
          builtin.description,
          language,
          SUPPORTED_LANGUAGES.EN,
        )!,
      }),
    }));
  }

  async createAutomation(
    body: CreateAutomationBody,
    actor: CurrentUserType,
    language?: SupportedLanguages,
  ) {
    const id = randomUUID();

    this.assertAutomationWorkflowStructure(body.workflow, id);

    const record = await this.automationDefinitionStorageService.createAutomation(
      {
        id,
        name: body.name,
        description: body.description,
        draftDefinition: body,
        tenantId: actor.tenantId,
      },
      undefined,
      language,
    );

    await this.recordAutomationActivity(ACTIVITY_LOG_ACTION_TYPES.CREATE, actor, record);

    return this.mapAutomationResponse(record);
  }

  async createAutomationFromTemplate(
    key: BuiltInEmailTemplateKey,
    actor: CurrentUserType,
    language?: SupportedLanguages,
  ) {
    const builtin = BUILT_IN_AUTOMATIONS.find((entry) => entry.templateKey === key);

    if (!builtin) {
      throw new NotFoundException("automations.errors.notFound");
    }

    const definition = buildBuiltInAutomationDefinition(builtin);

    const record = await this.automationDefinitionStorageService.createAutomation(
      {
        name: definition.name,
        description: definition.description,
        draftDefinition: definition,
        tenantId: actor.tenantId,
        localizedMetadata: {
          name: builtin.name,
          description: builtin.description,
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          availableLocales: Object.values(SUPPORTED_LANGUAGES),
        },
      },
      undefined,
      language,
    );

    await this.recordAutomationActivity(ACTIVITY_LOG_ACTION_TYPES.CREATE, actor, record);

    return this.mapAutomationResponse(record);
  }

  async updateAutomation(
    id: UUIDType,
    body: UpdateAutomationBody,
    actor: CurrentUserType,
    language?: SupportedLanguages,
  ) {
    return this.automationDefinitionStorageService.withAutomationTransaction(
      async (transaction) => {
        await acquireAutomationLifecycleLock(transaction);

        const current = await this.automationDefinitionStorageService.getAutomation(
          id,
          transaction,
          true,
          language,
        );

        this.assertAutomationEditable(current);

        const definition = { ...current.draftDefinition, ...body };

        this.assertAutomationWorkflowStructure(definition.workflow, id);

        const record = await this.automationDefinitionStorageService.updateAutomation(
          id,
          {
            name: body.name,
            description: body.description,
            draftDefinition: definition,
          },
          transaction,
          language,
        );

        await this.recordAutomationActivity(
          ACTIVITY_LOG_ACTION_TYPES.UPDATE,
          actor,
          record,
          current,
        );

        return this.mapAutomationResponse(record);
      },
    );
  }

  async deleteAutomation(id: UUIDType, actor: CurrentUserType): Promise<void> {
    await this.automationDefinitionStorageService.withAutomationTransaction(async (transaction) => {
      await acquireAutomationLifecycleLock(transaction);

      const current = await this.automationDefinitionStorageService.getAutomation(
        id,
        transaction,
        true,
      );

      await this.automationDefinitionStorageService.deleteAutomation(
        id,
        current.executionVersion + 1,
        transaction,
      );

      await this.automationRuntime.cancelPendingAutomationEmailDeliveries(
        transaction,
        id,
        "automation_deleted",
      );

      await this.activityLogsService.recordActivity({
        actor,
        operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
        resourceType: ACTIVITY_LOG_RESOURCE_TYPES.AUTOMATION,
        resourceId: current.id,
        before: {
          name: current.name,
          status: current.status,
          executionVersion: String(current.executionVersion),
        },
        after: null,
      });
    });
  }

  async duplicateAutomation(id: UUIDType, actor: CurrentUserType, language?: SupportedLanguages) {
    const current = await this.automationDefinitionStorageService.getAutomation(
      id,
      undefined,
      false,
      language,
    );

    const metadata =
      await this.automationDefinitionStorageService.getAutomationLocalizedMetadata(id);

    const definition = {
      ...current.draftDefinition,
      name: `${current.name} (copy)`.slice(0, 200),
      workflow: duplicateAutomationWorkflow(current.draftDefinition.workflow, () => randomUUID()),
    };

    const record = await this.automationDefinitionStorageService.createAutomation(
      {
        name: definition.name,
        description: definition.description,
        draftDefinition: definition,
        tenantId: actor.tenantId,
        localizedMetadata: {
          ...metadata,
          name: Object.fromEntries(
            Object.entries(metadata.name).map(([locale, name]) => [
              locale,
              `${name} (copy)`.slice(0, 200),
            ]),
          ),
          description: metadata.description,
        },
      },
      undefined,
      language,
    );

    await this.recordAutomationActivity(
      ACTIVITY_LOG_ACTION_TYPES.DUPLICATE_AUTOMATION,
      actor,
      record,
      undefined,
      {
        sourceAutomationId: id,
      },
    );

    return this.mapAutomationResponse(record);
  }

  async changeAutomationLifecycle(
    id: UUIDType,
    operation: AutomationLifecycleOperation,
    actor: CurrentUserType,
    language?: SupportedLanguages,
  ) {
    return this.automationDefinitionStorageService.withAutomationTransaction(
      async (transaction) => {
        await acquireAutomationLifecycleLock(transaction);

        const current = await this.automationDefinitionStorageService.getAutomation(
          id,
          transaction,
          true,
          language,
        );

        if (operation !== AUTOMATION_LIFECYCLE_OPERATIONS.ARCHIVE) {
          this.assertAutomationEditable(current);
        }

        const isApply = operation === AUTOMATION_LIFECYCLE_OPERATIONS.APPLY;

        const targetStatus = isApply
          ? current.status
          : AUTOMATION_LIFECYCLE_TARGET_STATUSES[operation];

        if (!isApply && current.status === targetStatus) {
          return this.mapAutomationResponse(current);
        }

        const shouldApplyDraft =
          isApply ||
          (operation === AUTOMATION_LIFECYCLE_OPERATIONS.ENABLE && !current.appliedDefinition);

        await this.assertWorkflowReadyForLifecycleChange(
          current,
          operation,
          shouldApplyDraft,
          actor.tenantId,
        );

        const record = await this.automationDefinitionStorageService.updateAutomation(
          id,
          {
            status: targetStatus,
            executionVersion: current.executionVersion + 1,
            ...(shouldApplyDraft ? { appliedDefinition: current.draftDefinition } : {}),
          },
          transaction,
          language,
        );

        await this.automationRuntime.cancelPendingAutomationEmailDeliveries(
          transaction,
          id,
          `automation_${operation}`,
        );

        await this.recordAutomationActivity(
          AUTOMATION_LIFECYCLE_ACTIVITY_TYPES[operation],
          actor,
          record,
          current,
        );

        return this.mapAutomationResponse(record);
      },
    );
  }

  private async assertWorkflowReadyForLifecycleChange(
    current: AutomationRecord,
    operation: AutomationLifecycleOperation,
    shouldApplyDraft: boolean,
    tenantId: UUIDType,
  ): Promise<void> {
    const isEnable = operation === AUTOMATION_LIFECYCLE_OPERATIONS.ENABLE;

    if (shouldApplyDraft) {
      await this.automationValidationAndSimulationService.assertAutomationReady(
        current.draftDefinition.workflow,
        current.id,
        tenantId,
      );
    } else if (isEnable && current.appliedDefinition) {
      await this.automationValidationAndSimulationService.assertAutomationReady(
        current.appliedDefinition.workflow,
        current.id,
        tenantId,
      );
    }
  }

  private mapAutomationResponse(record: AutomationRecord): AutomationResponse {
    return {
      ...record.draftDefinition,
      id: record.id,
      status: record.status,
      executionVersion: record.executionVersion,
      hasUnappliedChanges:
        record.hasLocalizedMetadataChanges ||
        JSON.stringify(record.draftDefinition) !== JSON.stringify(record.appliedDefinition),
      appliedDefinition: record.appliedDefinition,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private assertAutomationWorkflowStructure(
    workflow: CreateAutomationBody["workflow"],
    automationId?: UUIDType,
  ) {
    const issues = getAutomationWorkflowIssues(workflow, { automationId });

    if (issues.length > 0) {
      throw new BadRequestException({ message: "automations.errors.invalidWorkflow", issues });
    }
  }

  private assertAutomationEditable(record: AutomationRecord) {
    if (record.status === AUTOMATION_STATUSES.ARCHIVED) {
      throw new ConflictException("automations.errors.archived");
    }
  }

  private async recordAutomationActivity(
    operation: ActivityLogActionType,
    actor: CurrentUserType,
    record: AutomationRecord,
    before?: AutomationRecord,
    context?: Record<string, string>,
  ) {
    await this.activityLogsService.recordActivity({
      actor,
      operation,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.AUTOMATION,
      resourceId: record.id,
      before: before
        ? {
            name: before.name,
            status: before.status,
            executionVersion: String(before.executionVersion),
          }
        : null,
      after: {
        name: record.name,
        status: record.status,
        executionVersion: String(record.executionVersion),
      },
      changedFields: before ? ["definition", "status", "executionVersion"] : undefined,
      context,
    });
  }
}
