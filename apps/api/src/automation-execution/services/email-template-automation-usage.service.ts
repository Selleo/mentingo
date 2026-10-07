import { ConflictException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import {
  AUTOMATION_DEFINITION_KINDS,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
  flattenAutomationWorkflow,
  getAncestorConditionOutcomes,
} from "@repo/shared";

import { findAutomationEventDefinition } from "src/automations/catalog/automation-event-catalog";
import {
  getAccountActionPlaceholderNames,
  getAutomationMappingIssues,
  getAutomationBranchMappingIssues,
} from "src/automations/mappers/automation-mapping";
import { AutomationDefinitionStorageService } from "src/automations/services/automation-definition-storage.service";
import { EmailTemplateValidationService } from "src/email-templates/services/email-template-validation.service";

import { AutomationRunStatusService } from "./automation-run-status.service";

import type { PublishedEmailTemplate } from "@repo/email-templates";
import type { AutomationRecord } from "src/automations/automation.types";
import type { DatabasePg, UUIDType } from "src/common";
import type { EmailTemplateDependencies } from "src/email-templates/email-template.types";

@Injectable()
export class EmailTemplateAutomationUsageService implements EmailTemplateDependencies {
  constructor(
    private readonly automationDefinitionStorageService: AutomationDefinitionStorageService,
    private readonly automationRunStatusService: AutomationRunStatusService,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
  ) {}

  async removeUnusedEmailTagMappingsFromAutomations(
    templateId: UUIDType,
    publication: PublishedEmailTemplate,
    published: boolean,
    transaction: DatabasePg,
  ): Promise<void> {
    const usedTags = publication.placeholders.filter((tag) => tag.required).map((tag) => tag.name);

    await this.automationDefinitionStorageService.removeUnusedEmailTagMappings(
      templateId,
      usedTags,
      AUTOMATION_DEFINITION_KINDS.DRAFT,
      transaction,
    );

    if (published) {
      await this.automationDefinitionStorageService.removeUnusedEmailTagMappings(
        templateId,
        usedTags,
        AUTOMATION_DEFINITION_KINDS.APPLIED,
        transaction,
      );
    }
  }

  async assertEmailTemplateCanBeArchived(
    templateId: UUIDType,
    transaction: DatabasePg,
  ): Promise<void> {
    const dependents = await this.listEnabledAutomationsUsingEmailTemplate(templateId, transaction);

    if (dependents.length > 0) {
      throw new ConflictException({
        message: "emailTemplates.errors.usedByAutomations",
        automations: dependents.map(({ id, name }) => ({ id, name })),
      });
    }
  }

  async validateEmailTemplatePublicationDependencies(
    templateId: UUIDType,
    publication: PublishedEmailTemplate,
    transaction: DatabasePg,
  ): Promise<void> {
    const dependents = await this.listEnabledAutomationsUsingEmailTemplate(templateId, transaction);

    for (const automation of dependents) {
      this.validateAutomationEmailTemplateDependency(automation, templateId, publication);
    }
  }

  async cancelPendingEmailTemplateDeliveries(
    templateId: UUIDType,
    transaction: DatabasePg,
  ): Promise<void> {
    await this.automationRunStatusService.cancelAutomationEmailDeliveriesUsingCustomTemplate(
      transaction,
      templateId,
    );
  }

  private async listEnabledAutomationsUsingEmailTemplate(
    templateId: UUIDType,
    transaction: DatabasePg,
  ): Promise<AutomationRecord[]> {
    const enabledAutomations =
      await this.automationDefinitionStorageService.listEnabledAutomations(transaction);

    return enabledAutomations.filter((automation) =>
      automation.appliedDefinition?.workflow.steps.some(
        (step) =>
          step.type === AUTOMATION_STEP_TYPES.SEND_EMAIL &&
          step.config.template?.type === AUTOMATION_TEMPLATE_TYPES.CUSTOM &&
          step.config.template.id === templateId,
      ),
    );
  }

  private validateAutomationEmailTemplateDependency(
    automation: AutomationRecord,
    templateId: UUIDType,
    publication: PublishedEmailTemplate,
  ): void {
    if (!automation.appliedDefinition) {
      throw new UnprocessableEntityException("automations.errors.notReady");
    }

    const path = flattenAutomationWorkflow(automation.appliedDefinition.workflow);
    const trigger = path[0];

    const event =
      trigger?.type === AUTOMATION_STEP_TYPES.TRIGGER
        ? findAutomationEventDefinition(trigger.config.eventKind)
        : undefined;

    if (!event) {
      throw new UnprocessableEntityException("automations.errors.notReady");
    }

    for (const step of path) {
      if (
        step.type !== AUTOMATION_STEP_TYPES.SEND_EMAIL ||
        step.config.template?.type !== AUTOMATION_TEMPLATE_TYPES.CUSTOM ||
        step.config.template.id !== templateId
      ) {
        continue;
      }

      const mappings = step.config.mappings ?? {};

      const issues = [
        ...getAutomationMappingIssues(event, publication.placeholders, mappings, step.id),
        ...getAutomationBranchMappingIssues(
          event,
          publication.placeholders,
          mappings,
          step.id,
          getAncestorConditionOutcomes(automation.appliedDefinition.workflow, step.id, event),
        ),
      ];

      if (issues.length > 0) {
        throw new UnprocessableEntityException({
          message: "emailTemplates.errors.incompatiblePublication",
          automationId: automation.id,
          automationName: automation.name,
          issues,
        });
      }

      const sensitivePlaceholders = getAccountActionPlaceholderNames(event, mappings);

      this.emailTemplateValidationService.assertSafeAccountActionLinksInCompleteTranslations(
        publication,
        sensitivePlaceholders,
      );
    }
  }
}
