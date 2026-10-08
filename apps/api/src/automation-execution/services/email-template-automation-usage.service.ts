import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  AUTOMATION_STATUSES,
  PERMISSIONS,
  hasPermission,
  type SupportedLanguages,
  type AutomationWorkflowIssue,
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

import { AUTOMATION_EMAIL_DELIVERY_REASON_CODES } from "../automation-execution.constants";

import { AutomationRunStatusService } from "./automation-run-status.service";

import type { PublishedEmailTemplate } from "@repo/email-templates";
import type { AutomationRecord } from "src/automations/automation.types";
import type { DatabasePg, UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type { EmailTemplateDependencies } from "src/email-templates/email-template.types";
import type { PublishEmailTemplateBody } from "src/email-templates/schemas/email-template.schema";

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

  async prepareAutomationsForEmailTemplatePublication(
    templateId: UUIDType,
    publication: PublishedEmailTemplate,
    transaction: DatabasePg,
    options: PublishEmailTemplateBody = {},
    actor?: ActorUserType,
  ): Promise<void> {
    const dependents = await this.listEnabledAutomationsUsingEmailTemplate(
      templateId,
      transaction,
      options.language,
    );

    const incompatibleAutomations = dependents.flatMap((automation) => {
      const issues = this.getAutomationEmailTemplateIssues(automation, templateId, publication);

      return issues.length > 0 ? [{ automation, issues }] : [];
    });

    if (incompatibleAutomations.length === 0) {
      return;
    }

    const confirmedIds = new Set(options.confirmedAutomationIds ?? []);

    if (incompatibleAutomations.some(({ automation }) => !confirmedIds.has(automation.id))) {
      throw new ConflictException({
        message: "emailTemplates.errors.incompatiblePublication",
        automations: incompatibleAutomations.map(({ automation, issues }) => ({
          id: automation.id,
          name: automation.name,
          issues,
        })),
      });
    }

    if (!actor || !hasPermission(actor.permissions, PERMISSIONS.AUTOMATION_MANAGE)) {
      throw new ForbiddenException("auth.error.missingPermission");
    }

    for (const { automation } of incompatibleAutomations) {
      await this.automationDefinitionStorageService.updateAutomation(
        automation.id,
        { status: AUTOMATION_STATUSES.DISABLED, executionVersion: automation.executionVersion + 1 },
        transaction,
        options.language,
      );
      await this.automationRunStatusService.cancelPendingAutomationEmailDeliveries(
        transaction,
        automation.id,
        AUTOMATION_EMAIL_DELIVERY_REASON_CODES.AUTOMATION_DISABLED,
      );
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
    language?: SupportedLanguages,
  ): Promise<AutomationRecord[]> {
    const enabledAutomations = await this.automationDefinitionStorageService.listEnabledAutomations(
      transaction,
      language,
    );

    return enabledAutomations.filter((automation) =>
      automation.appliedDefinition?.workflow.steps.some(
        (step) =>
          step.type === AUTOMATION_STEP_TYPES.SEND_EMAIL &&
          step.config.template?.type === AUTOMATION_TEMPLATE_TYPES.CUSTOM &&
          step.config.template.id === templateId,
      ),
    );
  }

  private getAutomationEmailTemplateIssues(
    automation: AutomationRecord,
    templateId: UUIDType,
    publication: PublishedEmailTemplate,
  ) {
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

    const dependencyIssues: AutomationWorkflowIssue[] = [];

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

      dependencyIssues.push(...issues);

      const sensitivePlaceholders = getAccountActionPlaceholderNames(event, mappings);

      this.emailTemplateValidationService.assertSafeAccountActionLinksInCompleteTranslations(
        publication,
        sensitivePlaceholders,
      );
    }

    return dependencyIssues;
  }
}
