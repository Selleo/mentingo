import { randomUUID } from "node:crypto";

import { Injectable, NotFoundException } from "@nestjs/common";
import {
  AUTOMATION_DEFINITION_KINDS,
  AUTOMATION_NODE_KINDS,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_STATUSES,
  SUPPORTED_LANGUAGES,
  type AutomationStep,
  type AutomationDefinition,
  type AutomationDefinitionKind,
  type AutomationEventKind,
  type AutomationListQuery,
  type AutomationStatus,
  type AutomationWorkflow,
  type SupportedLanguages,
} from "@repo/shared";

import {
  assembleAutomationRecordFromRows,
  serializeAutomationStepConfiguration,
} from "../mappers/automation-persistence.mapper";
import { AutomationDefinitionRepository } from "../repositories/automation-definition.repository";

import type {
  LocalizedAutomationRow,
  AutomationLocalizedMetadata,
  AutomationMetadataUpdate,
  AutomationRecord,
  CreateAutomationRecord,
  UpdateAutomationRecord,
} from "../automation.types";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class AutomationDefinitionStorageService {
  constructor(private readonly automationDefinitionRepository: AutomationDefinitionRepository) {}

  removeUnusedEmailTagMappings(
    templateId: UUIDType,
    usedTags: string[],
    definitionKind: AutomationDefinitionKind,
    transaction: DatabasePg,
  ): Promise<void> {
    return this.automationDefinitionRepository.removeUnusedEmailTagMappings(
      templateId,
      usedTags,
      definitionKind,
      transaction,
    );
  }

  async listAutomations(query: AutomationListQuery) {
    return this.automationDefinitionRepository.withAutomationTransaction(
      async (transaction) => {
        const { rows, pagination } = await this.automationDefinitionRepository.findAutomationPage(
          query,
          transaction,
        );

        const data = await this.loadAutomationRecordsWithSteps(rows, transaction);

        return { data, pagination };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async getAutomation(
    id: UUIDType,
    transaction?: DatabasePg,
    lock = false,
    language?: SupportedLanguages,
  ): Promise<AutomationRecord> {
    if (!transaction) {
      return this.automationDefinitionRepository.withAutomationTransaction((handle) =>
        this.getAutomation(id, handle, lock, language),
      );
    }

    const row = await this.automationDefinitionRepository.findAutomationById(
      id,
      transaction,
      lock,
      language,
    );

    if (!row) {
      throw new NotFoundException("automations.errors.notFound");
    }

    const [record] = await this.loadAutomationRecordsWithSteps([row], transaction);

    return record;
  }

  async getAutomationLocalizedMetadata(id: UUIDType) {
    return this.automationDefinitionRepository.withAutomationTransaction(async (transaction) => {
      const metadata = await this.automationDefinitionRepository.findAutomationLocalizedMetadata(
        id,
        transaction,
      );

      if (!metadata) {
        throw new NotFoundException("automations.errors.notFound");
      }

      return metadata;
    });
  }

  async getAutomationsByIds(ids: UUIDType[], transaction: DatabasePg): Promise<AutomationRecord[]> {
    if (!ids.length) {
      return [];
    }

    const rows = await this.automationDefinitionRepository.findAutomationsByIds(ids, transaction);

    return this.loadAutomationRecordsWithSteps(rows, transaction);
  }

  async listEnabledAutomations(
    transaction: DatabasePg,
    language?: SupportedLanguages,
  ): Promise<AutomationRecord[]> {
    const rows = await this.automationDefinitionRepository.findEnabledAutomations(
      transaction,
      language,
    );

    return this.loadAutomationRecordsWithSteps(rows, transaction);
  }

  async createAutomation(
    values: CreateAutomationRecord,
    transaction?: DatabasePg,
    requestedLanguage?: SupportedLanguages,
  ): Promise<AutomationRecord> {
    if (!transaction) {
      return this.automationDefinitionRepository.withAutomationTransaction((handle) =>
        this.createAutomation(values, handle, requestedLanguage),
      );
    }

    const {
      draftDefinition,
      appliedDefinition,
      name,
      description,
      localizedMetadata,
      ...metadata
    } = values;

    const baseLanguage =
      localizedMetadata?.baseLanguage ?? requestedLanguage ?? SUPPORTED_LANGUAGES.EN;

    const availableLocales = localizedMetadata?.availableLocales ?? [baseLanguage];

    const row = await this.automationDefinitionRepository.insertAutomation(
      {
        ...metadata,
        id: values.id ?? randomUUID(),
        name: localizedMetadata?.name ?? { [baseLanguage]: name },
        description: localizedMetadata?.description ?? { [baseLanguage]: description },
        draftRootStepId: draftDefinition.workflow.rootStepId,
        appliedRootStepId: appliedDefinition?.workflow.rootStepId ?? null,
        baseLanguage,
        availableLocales,
        appliedName: appliedDefinition
          ? (localizedMetadata?.name ?? { [baseLanguage]: appliedDefinition.name })
          : null,
        appliedDescription: appliedDefinition
          ? (localizedMetadata?.description ?? { [baseLanguage]: appliedDefinition.description })
          : null,
      },
      transaction,
    );

    await this.replaceAutomationSteps(
      row.id,
      AUTOMATION_DEFINITION_KINDS.DRAFT,
      draftDefinition.workflow,
      transaction,
    );

    if (appliedDefinition) {
      await this.replaceAutomationSteps(
        row.id,
        AUTOMATION_DEFINITION_KINDS.APPLIED,
        appliedDefinition.workflow,
        transaction,
      );
    }

    return this.getAutomation(row.id, transaction, false, requestedLanguage);
  }

  async createDefaultAutomation(
    definition: AutomationDefinition,
    status: AutomationStatus,
    builtInKey: AutomationEventKind,
    transaction: DatabasePg,
    localizedMetadata?: AutomationLocalizedMetadata,
  ): Promise<AutomationRecord | null> {
    const existing = await this.automationDefinitionRepository.findBuiltInAutomationByEventKind(
      builtInKey,
      transaction,
    );

    if (existing) {
      return existing.deletedAt ? null : this.getAutomation(existing.id, transaction);
    }

    return this.createAutomation(
      {
        name: definition.name,
        description: definition.description,
        draftDefinition: definition,
        appliedDefinition: definition,
        status,
        executionVersion: 1,
        builtInKey,
        localizedMetadata,
      },
      transaction,
    );
  }

  async updateAutomation(
    id: UUIDType,
    values: UpdateAutomationRecord,
    transaction: DatabasePg,
    language?: SupportedLanguages,
  ): Promise<AutomationRecord> {
    const current = await this.getAutomation(id, transaction, false, language);
    const { name, description } = values;
    const update = this.buildAutomationMetadataUpdate(values);

    await this.automationDefinitionRepository.updateLocalizedAutomationMetadata(
      id,
      language ?? current.baseLanguage,
      update,
      transaction,
    );

    if (name !== undefined || description !== undefined) {
      await this.automationDefinitionRepository.updateAutomation(
        id,
        {
          availableLocales: [
            ...new Set([...current.availableLocales, language ?? current.baseLanguage]),
          ],
        },
        transaction,
      );
    }

    await this.saveUpdatedWorkflowDefinitions(id, values, transaction);

    return this.getAutomation(id, transaction, false, language);
  }

  async deleteAutomation(
    id: UUIDType,
    executionVersion: number,
    transaction: DatabasePg,
  ): Promise<void> {
    const deletedAt = new Date().toISOString();

    await this.automationDefinitionRepository.updateAutomation(
      id,
      {
        deletedAt,
        updatedAt: deletedAt,
        status: AUTOMATION_STATUSES.ARCHIVED,
        executionVersion,
      },
      transaction,
    );
  }

  withAutomationTransaction<T>(callback: (transaction: DatabasePg) => Promise<T>): Promise<T> {
    return this.automationDefinitionRepository.withAutomationTransaction(callback);
  }

  private buildAutomationMetadataUpdate(values: UpdateAutomationRecord): AutomationMetadataUpdate {
    const { draftDefinition, appliedDefinition, name, description, ...metadata } = values;

    const update: AutomationMetadataUpdate = {
      ...metadata,
      name,
      description,
      updatedAt: new Date().toISOString(),
    };

    if (draftDefinition) {
      update.draftRootStepId = draftDefinition.workflow.rootStepId;
    }

    if (appliedDefinition !== undefined) {
      update.appliedRootStepId = appliedDefinition?.workflow.rootStepId ?? null;
      update.appliedName = appliedDefinition?.name ?? null;
      update.appliedDescription = appliedDefinition?.description ?? null;
    }

    return update;
  }

  private async saveUpdatedWorkflowDefinitions(
    id: UUIDType,
    { draftDefinition, appliedDefinition }: UpdateAutomationRecord,
    transaction: DatabasePg,
  ): Promise<void> {
    if (draftDefinition) {
      await this.replaceAutomationSteps(
        id,
        AUTOMATION_DEFINITION_KINDS.DRAFT,
        draftDefinition.workflow,
        transaction,
      );
    }

    if (appliedDefinition) {
      await this.automationDefinitionRepository.copyDraftLocalizedMetadataToApplied(
        id,
        transaction,
      );
    }

    if (appliedDefinition !== undefined) {
      await this.replaceAutomationSteps(
        id,
        AUTOMATION_DEFINITION_KINDS.APPLIED,
        appliedDefinition?.workflow ?? { rootStepId: null, steps: [] },
        transaction,
      );
    }
  }

  private async loadAutomationRecordsWithSteps(
    rows: LocalizedAutomationRow[],
    transaction: DatabasePg,
  ): Promise<AutomationRecord[]> {
    if (!rows.length) {
      return [];
    }

    const steps = await this.automationDefinitionRepository.findAutomationSteps(
      rows.map((row) => row.id),
      transaction,
    );

    return rows.map((row) => assembleAutomationRecordFromRows(row, steps));
  }

  private async replaceAutomationSteps(
    automationId: UUIDType,
    definitionKind: AutomationDefinitionKind,
    workflow: AutomationWorkflow,
    transaction: DatabasePg,
  ): Promise<void> {
    await this.automationDefinitionRepository.deleteAutomationSteps(
      automationId,
      definitionKind,
      transaction,
    );

    if (!workflow.steps.length) {
      return;
    }

    await this.automationDefinitionRepository.insertAutomationSteps(
      workflow.steps.map((step) => ({
        id: step.id,
        automationId,
        definitionKind,
        parentId: step.parentId,
        position: step.position,
        nodeKind: this.getAutomationNodeKindForStepType(step.type),
        configuration: serializeAutomationStepConfiguration(step),
      })),
      transaction,
    );
  }

  private getAutomationNodeKindForStepType(type: AutomationStep["type"]) {
    if (type === AUTOMATION_STEP_TYPES.TRIGGER) {
      return AUTOMATION_NODE_KINDS.TRIGGER;
    }

    if (type === AUTOMATION_STEP_TYPES.CONDITION) {
      return AUTOMATION_NODE_KINDS.CONDITION;
    }

    return AUTOMATION_NODE_KINDS.ACTION;
  }
}
