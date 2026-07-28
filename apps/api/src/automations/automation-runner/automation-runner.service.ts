import { BadRequestException, Injectable, Logger } from "@nestjs/common";

import { AutomationStepType } from "src/announcements/types/automations.types";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import { AutomationDataResolverService } from "./automation-data-resolver.service";
import { AutomationTemplateService } from "./automation-template.service";

import type { AutomationResolvedRecipient } from "./automation-data-resolver.types";
import type { AutomationEventTypes } from "../handlers/automations-handler";
import type {
  AutomationStep,
  SendEmailActionContext,
  TypeContext,
} from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationRunnerService {
  private readonly logger = new Logger(AutomationRunnerService.name);

  constructor(
    private readonly automationStepsService: AutomationStepsService,
    private readonly dataResolver: AutomationDataResolverService,
    private readonly templateService: AutomationTemplateService,
  ) {}

  async startAutomation(automationId: UUIDType, event: AutomationEventTypes) {
    const automationSteps = await this.automationStepsService.getAllAutomationSteps(automationId);
    const resolvedRecipients = await this.dataResolver.resolve(event);

    if (resolvedRecipients.length === 0) {
      this.logger.warn(
        `No recipients resolved for automation ${automationId} (event: ${event.constructor.name})`,
      );
      return;
    }

    await this.executeAutomationSteps(automationSteps, resolvedRecipients);
  }

  private async executeAutomationSteps(
    steps: AutomationStep[],
    recipients: AutomationResolvedRecipient[],
  ) {
    const root = steps.find((step) => step.parentId === null);

    if (!root) {
      throw new BadRequestException("automationSteps.toast.stepTreeBuildFailed");
    }

    await this.executeStep(root, steps, recipients);
  }

  private async executeStep(
    step: AutomationStep,
    steps: AutomationStep[],
    recipients: AutomationResolvedRecipient[],
  ) {
    await this.executeSingleStep(step, recipients);

    const children = steps.filter((child) => child.parentId === step.id);

    for (const child of children) {
      await this.executeStep(child, steps, recipients);
    }
  }

  private async executeSingleStep(step: AutomationStep, recipients: AutomationResolvedRecipient[]) {
    switch (step.type) {
      case AutomationStepType.Trigger:
        this.logger.debug(`Trigger: ${JSON.stringify(step.typeContext)}`);
        break;

      case AutomationStepType.Condition:
        this.logger.debug(`Condition: ${JSON.stringify(step.typeContext)}`);
        break;

      case AutomationStepType.Action:
        console.log("action worked");
        await this.handleAction(step.typeContext as TypeContext, recipients);
        break;

      default:
        throw new BadRequestException(`Unknown step type ${step.type}`);
    }
  }

  private async handleAction(
    actionContext: TypeContext,
    recipients: AutomationResolvedRecipient[],
  ) {
    switch (actionContext.name) {
      case "send_email":
        // await this.handleSendEmailAction(
        //   actionContext as SendEmailActionContext,
        //   recipients,
        // );
        console.log("ActionContext", actionContext);
        console.log("Recipients: ", recipients);
        break;
      default:
        this.logger.warn(`Unknown action: ${actionContext.name}`);
    }
  }

  private async handleSendEmailAction(
    actionContext: SendEmailActionContext,
    recipients: AutomationResolvedRecipient[],
  ) {
    const { templateId, variableMapping } = actionContext;

    console.log("[Automation] Action context:", JSON.stringify(actionContext, null, 2));
    console.log("[Automation] Variable mapping:", JSON.stringify(variableMapping, null, 2));
    console.log("[Automation] Recipients count:", recipients.length);

    const template = await this.templateService.getTemplate(templateId);

    if (!template) {
      this.logger.error(`Email template not found: ${templateId}`);
      return;
    }

    console.log("[Automation] Template:", JSON.stringify(template, null, 2));

    for (const recipient of recipients) {
      console.log("[Automation] Recipient resolved variables:", JSON.stringify(recipient, null, 2));

      const renderedSubject = this.replacePlaceholders(
        template.subject,
        variableMapping,
        recipient.variables,
      );
      const renderedBody = this.replacePlaceholders(
        template.body,
        variableMapping,
        recipient.variables,
      );

      console.log("[Automation] Rendered subject:", renderedSubject);
      console.log("[Automation] Rendered body:", renderedBody);

      // TODO: integrate with EmailService to actually send the rendered email
      // await this.emailService.sendEmailWithLogo(
      //   { to: recipient.userEmail, subject: renderedSubject, html: renderedBody, text: renderedBody },
      //   { tenantId: recipient.tenantId },
      // );
    }
  }

  /**
   * Replaces placeholders in the template content using the user-defined
   * variableMapping and the resolved recipient variables.
   *
   * `variableMapping` maps template placeholders (e.g. "{{recipient_name}}")
   * to trigger variable keys (e.g. "userFirstName").
   *
   * The method finds each placeholder in the template and replaces it with
   * the actual value from the resolved recipient data.
   */
  private replacePlaceholders(
    templateContent: string,
    variableMapping: Record<string, string>,
    resolvedVariables: Record<string, string>,
  ): string {
    let result = templateContent;

    for (const [placeholder, variableKey] of Object.entries(variableMapping)) {
      const value = resolvedVariables[variableKey] ?? "";
      result = result.replaceAll(placeholder, value);
    }

    return result;
  }
}
