import { Injectable } from "@nestjs/common";
import { getBuiltInTemplatePublication } from "@repo/email-templates";
import {
  AUTOMATION_STATUSES,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
  SUPPORTED_LANGUAGES,
  type LocalizedText,
} from "@repo/shared";
import { isEqual } from "lodash";

import { findAutomationEventDefinition } from "src/automations/catalog/automation-event-catalog";
import {
  getAccountActionPlaceholderNames,
  getAutomationMappingIssues,
} from "src/automations/mappers/automation-mapping";
import { AutomationDefinitionStorageService } from "src/automations/services/automation-definition-storage.service";
import { EmailTemplateValidationService } from "src/email-templates/services/email-template-validation.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { BUILT_IN_AUTOMATIONS } from "../catalog";
import { buildBuiltInAutomationDefinition } from "../mappers/builtin-automation.mapper";
import { DefaultAutomationSetupRepository } from "../repositories/default-automation-setup.repository";
import { acquireAutomationLifecycleLock } from "../utils/acquire-automation-lifecycle-lock";

import type { AutomationRecord } from "src/automations/automation.types";
import type { DatabasePg } from "src/common";

@Injectable()
export class DefaultAutomationSetupService {
  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly automationDefinitionStorageService: AutomationDefinitionStorageService,
    private readonly defaultAutomationSetupRepository: DefaultAutomationSetupRepository,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
  ) {}

  async ensureDefaultAutomationsForAllTenants(): Promise<void> {
    await this.tenantDbRunnerService.runForEachTenant(() =>
      this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
        await acquireAutomationLifecycleLock(transaction);
        await this.defaultAutomationSetupRepository.cancelLegacyNotificationEmailCommands(
          transaction,
        );
        await this.ensureTenantDefaultAutomations(transaction);
        await this.validateTenantBuiltInAutomationDependencies(transaction);
      }),
    );
  }

  async ensureTenantDefaultAutomations(transaction?: DatabasePg): Promise<void> {
    if (transaction) {
      await this.ensureTenantAutomationCatalog(transaction);

      return;
    }

    await this.tenantDbRunnerService.transactionWithHandle((database) =>
      this.ensureTenantAutomationCatalog(database),
    );
  }

  private async ensureTenantAutomationCatalog(transaction: DatabasePg): Promise<void> {
    await acquireAutomationLifecycleLock(transaction);

    await this.populateMissingDefaultAutomationTranslations(transaction);

    const builtInKeys =
      await this.defaultAutomationSetupRepository.listTenantDefaultAutomationScenarios(transaction);

    const existingScenarios = new Set(builtInKeys.map(({ scenario }) => scenario));

    if (BUILT_IN_AUTOMATIONS.every(({ eventKind }) => existingScenarios.has(eventKind))) {
      return;
    }

    await this.defaultAutomationSetupRepository.cancelLegacyNotificationEmailCommands(transaction);
    await this.createTenantDefaultAutomations(transaction);
  }

  private async validateTenantBuiltInAutomationDependencies(
    transaction: DatabasePg,
  ): Promise<void> {
    const enabledAutomations =
      await this.automationDefinitionStorageService.listEnabledAutomations(transaction);

    for (const automation of enabledAutomations) {
      this.validateBuiltInAutomationDependencies(automation);
    }
  }

  private async createTenantDefaultAutomations(transaction: DatabasePg): Promise<void> {
    const organization =
      await this.defaultAutomationSetupRepository.findOrganizationNotificationSettings(transaction);

    const settings = organization?.values as Record<string, unknown> | undefined;
    const switches = (settings?.userEmailTriggers as Record<string, boolean> | undefined) ?? {};

    const customizations =
      await this.defaultAutomationSetupRepository.listPublishedCustomEmailTemplates(transaction);

    for (const builtin of BUILT_IN_AUTOMATIONS) {
      const customization = customizations.find(
        (template) => template.event === builtin.eventKind && template.publication,
      );

      const definition = buildBuiltInAutomationDefinition(builtin, customization);
      const enabled = builtin.legacySettingKey ? switches[builtin.legacySettingKey] === true : true;

      await this.automationDefinitionStorageService.createDefaultAutomation(
        definition,
        enabled ? AUTOMATION_STATUSES.ENABLED : AUTOMATION_STATUSES.DISABLED,
        builtin.eventKind,
        transaction,
        {
          name: builtin.name,
          description: builtin.description,
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          availableLocales: Object.values(SUPPORTED_LANGUAGES),
        },
      );
    }
  }

  private async populateMissingDefaultAutomationTranslations(
    transaction: DatabasePg,
  ): Promise<void> {
    const automations =
      await this.defaultAutomationSetupRepository.listTenantDefaultAutomationTranslations(
        transaction,
      );

    for (const automation of automations) {
      const builtin = BUILT_IN_AUTOMATIONS.find((item) => item.eventKind === automation.builtInKey);

      if (!builtin) {
        continue;
      }

      const name = this.mergeDefaultTranslations(automation.name, builtin.name);

      const description = this.mergeDefaultTranslations(
        automation.description,
        builtin.description,
        builtin.legacyDescription,
      );

      const appliedName = this.mergeDefaultTranslations(automation.appliedName, builtin.name);

      const appliedDescription = this.mergeDefaultTranslations(
        automation.appliedDescription,
        builtin.description,
        builtin.legacyDescription,
      );

      const availableLocales = Object.values(SUPPORTED_LANGUAGES).filter(
        (language) => name?.[language] !== undefined && description?.[language] !== undefined,
      );

      const update = { name, description, appliedName, appliedDescription, availableLocales };

      const current = {
        name: automation.name,
        description: automation.description,
        appliedName: automation.appliedName,
        appliedDescription: automation.appliedDescription,
        availableLocales: automation.availableLocales,
      };

      if (isEqual(update, current)) {
        continue;
      }

      await this.defaultAutomationSetupRepository.updateDefaultAutomationTranslations(
        automation.id,
        update,
        transaction,
      );
    }
  }

  private mergeDefaultTranslations(
    current: LocalizedText,
    defaults: LocalizedText,
    legacyEnglish?: string,
  ): LocalizedText;

  private mergeDefaultTranslations(
    current: LocalizedText | null,
    defaults: LocalizedText,
    legacyEnglish?: string,
  ): LocalizedText | null;

  private mergeDefaultTranslations(
    current: LocalizedText | null,
    defaults: LocalizedText,
    legacyEnglish?: string,
  ): LocalizedText | null {
    if (
      !current ||
      (current[SUPPORTED_LANGUAGES.EN] !== defaults[SUPPORTED_LANGUAGES.EN] &&
        (!legacyEnglish || current[SUPPORTED_LANGUAGES.EN] !== legacyEnglish))
    ) {
      return current;
    }

    return { ...defaults, ...current };
  }

  private validateBuiltInAutomationDependencies(automation: AutomationRecord): void {
    const workflow = automation.appliedDefinition?.workflow;
    const trigger = workflow?.steps.find((step) => step.id === workflow.rootStepId);

    const event =
      trigger?.type === AUTOMATION_STEP_TYPES.TRIGGER
        ? findAutomationEventDefinition(trigger.config.eventKind)
        : undefined;

    if (!workflow || !event) {
      throw new Error("An enabled automation is not ready for built-in template validation");
    }

    for (const step of workflow.steps) {
      if (
        step.type !== AUTOMATION_STEP_TYPES.SEND_EMAIL ||
        step.config.template?.type !== AUTOMATION_TEMPLATE_TYPES.BUILTIN
      ) {
        continue;
      }

      const publication = getBuiltInTemplatePublication(step.config.template.key);
      const mappings = step.config.mappings ?? {};
      const issues = getAutomationMappingIssues(event, publication.placeholders, mappings, step.id);

      if (issues.length > 0) {
        throw new Error("An enabled automation is incompatible with the new built-in catalog");
      }

      const sensitivePlaceholders = getAccountActionPlaceholderNames(event, mappings);

      this.emailTemplateValidationService.assertSafeAccountActionLinksInCompleteTranslations(
        publication,
        sensitivePlaceholders,
      );
    }
  }
}
