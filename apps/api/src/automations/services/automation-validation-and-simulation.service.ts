import {
  UnprocessableEntityException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { getUsedEmailTemplateVariables, type PublishedEmailTemplate } from "@repo/email-templates";
import {
  ACTIVITY_LOG_ACTION_TYPES,
  AUTOMATION_VALIDATION_ISSUE_CODES,
  AUTOMATION_RECIPIENT_TYPES,
  AUTOMATION_PLACEHOLDER_TYPES,
  AUTOMATION_FIELD_SENSITIVITIES,
  getAncestorConditionOutcomes,
  getCanonicalAutomationField,
  AUTOMATION_TRIGGER_DEFINITIONS,
  deriveAutomationBranchFieldValues,
  AUTOMATION_STEP_TYPES,
  evaluateAutomationWorkflow,
  getAutomationWorkflowIssues,
  SUPPORTED_LANGUAGES,
  type AutomationEventDefinition,
  type AutomationRecipientSelection,
  type AutomationPlaceholderMappings,
  type AutomationSendEmailStep,
  type AutomationStep,
  type AutomationTemplateReference,
  type SupportedLanguages,
  type AutomationWorkflow,
  type AutomationWorkflowIssue,
  type AutomationPlaceholderValue,
} from "@repo/shared";

import { EmailService } from "src/common/emails/emails.service";
import { isJsonValue } from "src/common/utils/isJsonValue";
import { EmailTemplateManagementService } from "src/email-templates/services/email-template-management.service";
import {
  generateEmailPreviewTagValue,
  generateEmailPreviewRecipient,
} from "src/email-templates/services/email-template-placeholder.utils";
import { EmailTemplateRenderingService } from "src/email-templates/services/email-template-rendering.service";
import { EmailTemplateValidationService } from "src/email-templates/services/email-template-validation.service";
import { AutomationActivityEvent } from "src/events/automation/automation-activity.event";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

import { findAutomationEventDefinition } from "../catalog/automation-event-catalog";
import {
  getAccountActionPlaceholderNames,
  resolveAutomationMappings,
  getAutomationMappingIssues,
  getAutomationBranchMappingIssues,
  isValidAutomationPlaceholderValue,
} from "../mappers/automation-mapping";
import { AutomationRecipientOptionsRepository } from "../repositories/automation-recipient-options.repository";

import { AutomationDefinitionStorageService } from "./automation-definition-storage.service";

import type { AutomationSimulationEventData } from "../automation.types";
import type {
  AutomationSimulationResponse,
  AutomationTemplateResponse,
  SimulateAutomationBody,
} from "../schema/automation.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AutomationValidationAndSimulationService {
  constructor(
    private readonly outboxPublisher: OutboxPublisher,
    private readonly automationDefinitionStorageService: AutomationDefinitionStorageService,
    private readonly emailTemplateRenderingService: EmailTemplateRenderingService,
    private readonly emailTemplateManagementService: EmailTemplateManagementService,
    private readonly emailService: EmailService,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
    private readonly localizationService: LocalizationService,
    private readonly automationRecipientOptionsRepository: AutomationRecipientOptionsRepository,
  ) {}

  assertJsonSerializableAutomationInput(value: unknown): void {
    if (!isJsonValue(value)) {
      throw new BadRequestException("automations.errors.invalidWorkflow");
    }
  }

  async listPublishedEmailTemplateOptions(
    language?: SupportedLanguages,
  ): Promise<AutomationTemplateResponse[]> {
    const templates = await this.emailTemplateManagementService.getPublishedEmailTemplateCatalog();

    return templates.map((template) => ({
      reference: template.reference,
      baseLanguage: template.baseLanguage,
      placeholders: template.placeholders,
      name:
        this.localizationService.getLocalizedValue(
          template.name,
          language ?? template.baseLanguage,
          template.baseLanguage,
        ) ?? "",
    }));
  }

  async collectAutomationReadinessIssues(
    workflow: AutomationWorkflow,
    automationId?: UUIDType,
    tenantId?: UUIDType,
  ): Promise<AutomationWorkflowIssue[]> {
    const issues = getAutomationWorkflowIssues(workflow, { requireComplete: true, automationId });
    const event = this.findWorkflowTriggerEventDefinition(workflow);

    if (!event) {
      return issues;
    }

    for (const step of workflow.steps) {
      if (step.type === AUTOMATION_STEP_TYPES.CONDITION) {
        const field = event.fields.find((field) => field.key === step.config.field);

        if (
          !field ||
          field.type !== AUTOMATION_PLACEHOLDER_TYPES.BOOLEAN ||
          field.sensitivity === AUTOMATION_FIELD_SENSITIVITIES.ACCOUNT_ACTION_LINK
        ) {
          issues.push({
            code: AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_CONDITION_FIELD,
            message: "Choose an available Yes/No field from this event.",
            stepId: step.id,
          });
        }

        continue;
      }

      if (step.type !== AUTOMATION_STEP_TYPES.SEND_EMAIL || !step.config.template) {
        continue;
      }

      const recipientIssues = await this.collectEmailRecipientIssues(event, step, tenantId);

      const templateIssues = await this.collectEmailStepReadinessIssues(
        event,
        step,
        step.config.template,
        getAncestorConditionOutcomes(workflow, step.id, event),
      );

      issues.push(...recipientIssues, ...templateIssues);
    }

    return issues;
  }

  async assertAutomationReady(
    workflow: AutomationWorkflow,
    automationId?: UUIDType,
    tenantId?: UUIDType,
  ) {
    const issues = await this.collectAutomationReadinessIssues(workflow, automationId, tenantId);

    if (issues.length) {
      throw new UnprocessableEntityException({ message: "automations.errors.notReady", issues });
    }
  }

  async simulateAutomation(
    body: SimulateAutomationBody,
    actor: CurrentUserType,
  ): Promise<AutomationSimulationResponse> {
    const record = body.automationId
      ? await this.automationDefinitionStorageService.getAutomation(
          body.automationId,
          undefined,
          false,
          body.language,
        )
      : undefined;

    const result = await this.evaluateSimulation(body, actor);

    await this.outboxPublisher.publish(
      new AutomationActivityEvent({
        actor,
        operation: ACTIVITY_LOG_ACTION_TYPES.SIMULATE_AUTOMATION,
        resourceId: record?.id,
        context: {
          name: record?.name ?? "",
          language: body.language ?? record?.baseLanguage ?? SUPPORTED_LANGUAGES.EN,
          outcome: result.issues.length ? "issues_found" : "success",
          issueCodes: JSON.stringify(result.issues.map((issue) => issue.code)),
          issueCount: String(result.issues.length),
          previewCount: String(result.previews.length),
          evaluatedStepCount: String(result.steps.length),
          savedAutomation: String(Boolean(record)),
        },
      }),
    );

    return result;
  }

  private async evaluateSimulation(
    body: SimulateAutomationBody,
    actor: CurrentUserType,
  ): Promise<AutomationSimulationResponse> {
    const issues = await this.collectAutomationReadinessIssues(
      body.workflow,
      undefined,
      actor.tenantId,
    );

    const event = this.findWorkflowTriggerEventDefinition(body.workflow);

    const result: AutomationSimulationResponse = {
      issues,
      recipientPolicy: event?.recipientPolicy ?? null,
      sampleRecipient: event ? generateEmailPreviewRecipient(body.language) : null,
      previews: [],
      steps: [],
    };

    if (!event) {
      return result;
    }

    result.recipientPolicy = await this.describeSimulationRecipients(
      body.workflow,
      event,
      actor.tenantId,
      body.language,
    );

    const { fields, issues: sampleIssues } = this.buildSimulationEventFields(
      event,
      body.sampleValues ?? {},
      body.language,
    );

    issues.push(...sampleIssues);

    if (issues.length) {
      return result;
    }

    const evaluation = evaluateAutomationWorkflow(body.workflow, fields);

    result.steps = evaluation.steps;

    if (evaluation.issue) {
      result.issues.push(evaluation.issue);

      return result;
    }

    const emailSimulation = await this.renderSimulationEmailPreviews(
      event,
      evaluation.path,
      fields,
      body.language,
      actor,
    );

    result.previews = emailSimulation.previews;
    result.issues.push(...emailSimulation.issues);

    return result;
  }

  private async renderSimulationEmailPreviews(
    event: AutomationEventDefinition,
    path: AutomationStep[],
    fields: Record<string, AutomationPlaceholderValue>,
    language: SupportedLanguages | undefined,
    actor: CurrentUserType,
  ): Promise<Pick<AutomationSimulationResponse, "previews" | "issues">> {
    const previews: AutomationSimulationResponse["previews"] = [];
    const issues: AutomationWorkflowIssue[] = [];

    for (const step of path) {
      if (step.type !== AUTOMATION_STEP_TYPES.SEND_EMAIL || !step.config.template) {
        continue;
      }

      try {
        const preview = await this.simulateAutomationEmailStep(
          event,
          step,
          step.config.template,
          fields,
          language,
          actor,
        );

        previews.push({
          ...preview,
          sampleRecipient: generateEmailPreviewRecipient(preview.language),
        });
      } catch (error) {
        if (
          !(error instanceof BadRequestException) &&
          !(error instanceof UnprocessableEntityException)
        ) {
          throw error;
        }

        issues.push({
          code: AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_TEMPLATE_MAPPING,
          message: "The template cannot render the configured mappings safely.",
          stepId: step.id,
        });
      }
    }

    return { previews, issues };
  }

  private findWorkflowTriggerEventDefinition(workflow: AutomationWorkflow) {
    const trigger = workflow.steps.find((step) => step.id === workflow.rootStepId);

    if (trigger?.type !== AUTOMATION_STEP_TYPES.TRIGGER) {
      return undefined;
    }

    return findAutomationEventDefinition(trigger.config.eventKind);
  }

  private async collectEmailRecipientIssues(
    event: AutomationEventDefinition,
    step: AutomationSendEmailStep,
    tenantId?: UUIDType,
  ): Promise<AutomationWorkflowIssue[]> {
    const issues: AutomationWorkflowIssue[] = [];
    const recipients = step.config.recipients ?? { type: AUTOMATION_RECIPIENT_TYPES.EVENT };

    if (
      !(await this.automationRecipientOptionsRepository.doesAutomationRecipientSelectionExist(
        recipients,
        tenantId,
      ))
    ) {
      issues.push({
        code: AUTOMATION_VALIDATION_ISSUE_CODES.UNAVAILABLE_RECIPIENTS,
        message: "Select available recipients in this organization.",
        stepId: step.id,
      });
    }

    if (
      recipients.type !== AUTOMATION_RECIPIENT_TYPES.EVENT &&
      getAccountActionPlaceholderNames(event, step.config.mappings ?? {}).length > 0
    ) {
      issues.push({
        code: AUTOMATION_VALIDATION_ISSUE_CODES.UNSAFE_ACCOUNT_ACTION_RECIPIENTS,
        message: "Account action emails must use event-linked recipients.",
        stepId: step.id,
      });
    }

    return issues;
  }

  private async describeSimulationRecipients(
    workflow: AutomationWorkflow,
    event: AutomationEventDefinition,
    tenantId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<string> {
    const emailSteps = workflow.steps.filter(
      (step): step is AutomationSendEmailStep => step.type === AUTOMATION_STEP_TYPES.SEND_EMAIL,
    );

    const descriptions = await Promise.all(
      emailSteps.map(async (step, index) => {
        const selection = step.config.recipients ?? { type: AUTOMATION_RECIPIENT_TYPES.EVENT };

        const description = await this.describeRecipientSelection(
          selection,
          event,
          tenantId,
          language,
        );

        return `${index + 1}: ${description}`;
      }),
    );

    return descriptions.join("; ");
  }

  private async describeRecipientSelection(
    selection: AutomationRecipientSelection,
    event: AutomationEventDefinition,
    tenantId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<string> {
    let id: UUIDType;

    switch (selection.type) {
      case AUTOMATION_RECIPIENT_TYPES.EVENT:
        return event.recipientPolicy;
      case AUTOMATION_RECIPIENT_TYPES.EVERYONE:
        return "Everyone in this organization";
      case AUTOMATION_RECIPIENT_TYPES.USER:
        id = selection.userId;
        break;
      case AUTOMATION_RECIPIENT_TYPES.GROUP:
        id = selection.groupId;
        break;
      case AUTOMATION_RECIPIENT_TYPES.ROLE:
        id = selection.roleId;
        break;
    }

    const { rows } =
      await this.automationRecipientOptionsRepository.findAutomationRecipientOptionsPage(
        { type: selection.type, id, language },
        tenantId,
      );

    return `${selection.type}: ${rows[0]?.label ?? "Unavailable recipients"}`;
  }

  private async collectEmailStepReadinessIssues(
    event: AutomationEventDefinition,
    step: AutomationSendEmailStep,
    reference: AutomationTemplateReference,
    facts: Record<string, boolean>,
  ): Promise<AutomationWorkflowIssue[]> {
    const issues: AutomationWorkflowIssue[] = [];

    try {
      const publication =
        await this.emailTemplateRenderingService.getPublishedEmailTemplate(reference);

      const mappings = step.config.mappings ?? {};

      issues.push(
        ...getAutomationMappingIssues(event, publication.placeholders, mappings, step.id),
      );

      issues.push(
        ...getAutomationBranchMappingIssues(
          event,
          publication.placeholders,
          mappings,
          step.id,
          facts,
        ),
      );

      this.assertSafeAccountActionLinksInTranslations(event, publication, mappings);

      return issues;
    } catch (error) {
      if (!(error instanceof NotFoundException) && !(error instanceof BadRequestException)) {
        throw error;
      }

      issues.push({
        code: AUTOMATION_VALIDATION_ISSUE_CODES.UNAVAILABLE_TEMPLATE,
        message: "Select an available published template.",
        stepId: step.id,
      });

      return issues;
    }
  }

  private assertSafeAccountActionLinksInTranslations(
    event: AutomationEventDefinition,
    publication: PublishedEmailTemplate,
    mappings: AutomationPlaceholderMappings,
  ) {
    const sensitiveKeys = getAccountActionPlaceholderNames(event, mappings);

    this.emailTemplateValidationService.assertSafeAccountActionLinksInCompleteTranslations(
      publication,
      sensitiveKeys,
    );
  }

  private buildSimulationEventFields(
    event: AutomationEventDefinition,
    sampleValues: Record<string, AutomationPlaceholderValue>,
    language?: SupportedLanguages,
  ): AutomationSimulationEventData {
    const issues: AutomationWorkflowIssue[] = [];

    const fields: Record<string, AutomationPlaceholderValue> = Object.fromEntries(
      event.fields.map((field) => [
        field.key,
        generateEmailPreviewTagValue(field.key, field.type, language),
      ]),
    );

    this.copySimulationFieldAliases(event, fields);

    Object.assign(fields, deriveAutomationBranchFieldValues(event.kind, fields));

    for (const [key, value] of Object.entries(sampleValues)) {
      const field = event.fields.find((item) => item.key === key);

      if (!field || !isValidAutomationPlaceholderValue(value, field.type)) {
        issues.push({
          code: AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_SAMPLE,
          message: "Sample values must match the selected event field type.",
          placeholder: key,
        });

        continue;
      }

      // Only boolean scenarios are author-controlled; text and credentials remain synthetic.
      if (field.type === AUTOMATION_PLACEHOLDER_TYPES.BOOLEAN) {
        fields[getCanonicalAutomationField(event, key)] = value;
      }
    }

    this.copySimulationFieldAliases(event, fields);

    return { fields, issues };
  }

  private copySimulationFieldAliases(
    event: AutomationEventDefinition,
    fields: Record<string, AutomationPlaceholderValue>,
  ): void {
    for (const variable of [
      ...(AUTOMATION_TRIGGER_DEFINITIONS.find((trigger) => trigger.type === event.kind)
        ?.providedVariables ?? []),
      ...event.providedVariables,
    ]) {
      if (variable.sourceKey && fields[variable.sourceKey] !== undefined) {
        fields[variable.key] = fields[variable.sourceKey];
      }
    }
  }

  private async simulateAutomationEmailStep(
    event: AutomationEventDefinition,
    step: AutomationSendEmailStep,
    reference: AutomationTemplateReference,
    fields: Record<string, AutomationPlaceholderValue>,
    simulationLanguage: SupportedLanguages | undefined,
    actor: CurrentUserType,
  ): Promise<AutomationSimulationResponse["previews"][number]> {
    const publication =
      await this.emailTemplateRenderingService.getPublishedEmailTemplate(reference);

    const requestedLanguage = simulationLanguage ?? SUPPORTED_LANGUAGES.EN;

    const language = this.emailTemplateValidationService.resolveEmailTemplateLanguage(
      publication.subject,
      publication.content,
      requestedLanguage,
      publication.baseLanguage,
    );

    const branding = await this.emailService.getDefaultEmailProperties(
      actor.tenantId,
      undefined,
      language,
    );

    const { fields: localizedFields } = this.buildSimulationEventFields(event, fields, language);

    const mappings = step.config.mappings ?? {};

    const variables = resolveAutomationMappings(
      mappings,
      localizedFields,
      language,
      publication.baseLanguage,
      getUsedEmailTemplateVariables(
        { [language]: publication.subject[language] },
        { [language]: publication.content[language]! },
      ),
    );

    const sensitivePlaceholderKeys = getAccountActionPlaceholderNames(event, mappings);

    const preview = await this.emailTemplateRenderingService.renderMappedEmailTemplate(
      actor.tenantId,
      reference,
      language,
      variables,
      {
        ...branding,
        logoUrl: await this.emailService.getEmailPreviewLogo(actor.tenantId),
        borderCircleUrl: await this.emailService.getEmailPreviewBorderCircle(actor.tenantId),
      },
      { preview: true, sensitivePlaceholderKeys },
    );

    return {
      stepId: step.id,
      template: reference,
      subject: preview.subject,
      html: preview.html,
      language: preview.language,
    };
  }
}
