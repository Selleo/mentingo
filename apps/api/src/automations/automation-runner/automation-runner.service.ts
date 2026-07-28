import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";

import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { SettingsService } from "src/settings/settings.service";
import { DB_ADMIN } from "src/storage/db/db.providers";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import { AutomationDataResolverService } from "./automation-data-resolver.service";
import {
  AutomationSystemTemplateRendererService,
  isSystemTemplateId,
} from "./automation-system-template-renderer.service";
import { AutomationTemplateService } from "./automation-template.service";

import type { AutomationResolvedRecipient } from "./automation-data-resolver.types";
import type { AutomationEventTypes } from "../handlers/automations-handler";
import type { SupportedLanguages } from "@repo/shared";
import type {
  AutomationStep,
  SendEmailActionContext,
  TypeContext,
} from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

/** Sentinel value — resolve language from the recipient's user settings */
const USER_DEFAULT_LANGUAGE = "user_default";

@Injectable()
export class AutomationRunnerService {
  private readonly logger = new Logger(AutomationRunnerService.name);

  constructor(
    private readonly automationStepsService: AutomationStepsService,
    private readonly dataResolver: AutomationDataResolverService,
    private readonly templateService: AutomationTemplateService,
    private readonly systemTemplateRenderer: AutomationSystemTemplateRendererService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
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
      case "trigger":
        this.logger.debug(`Trigger: ${JSON.stringify(step.typeContext)}`);
        break;

      case "condition":
        this.logger.debug(`Condition: ${JSON.stringify(step.typeContext)}`);
        break;

      case "action":
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
        await this.handleSendEmailAction(actionContext as SendEmailActionContext, recipients);
        break;
      default:
        this.logger.warn(`Unknown action: ${actionContext.name}`);
    }
  }

  private async handleSendEmailAction(
    actionContext: SendEmailActionContext,
    recipients: AutomationResolvedRecipient[],
  ) {
    const { templateId, language, variableMapping } = actionContext;
    const isUserDefault = language === USER_DEFAULT_LANGUAGE;

    if (isSystemTemplateId(templateId)) {
      await this.handleSystemTemplateEmail(templateId, recipients, isUserDefault, language);
    } else {
      await this.handleCustomTemplateEmail(
        templateId,
        recipients,
        isUserDefault,
        language,
        variableMapping,
      );
    }
  }

  /**
   * Handles sending system (hardcoded) email templates.
   * The system renderer maps resolved variables directly to typed template props.
   */
  private async handleSystemTemplateEmail(
    templateId: string,
    recipients: AutomationResolvedRecipient[],
    isUserDefault: boolean,
    languageOverride?: string,
  ) {
    for (const recipient of recipients) {
      const recipientLanguage = isUserDefault
        ? await this.resolveRecipientLanguage(recipient.userId)
        : (languageOverride as SupportedLanguages | undefined);

      const rendered = await this.systemTemplateRenderer.render(
        templateId,
        recipient.variables,
        recipient.tenantId,
        recipient.userId,
        recipientLanguage,
      );

      if (!rendered) {
        this.logger.error(`System template render failed: ${templateId}`);
        continue;
      }

      await this.emailService.sendEmailWithLogo(
        {
          to: recipient.userEmail,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        },
        { tenantId: recipient.tenantId },
      );

      this.logger.debug(
        `[Automation] Sent system email to ${recipient.userEmail}: subject="${rendered.subject}"`,
      );
    }
  }

  /**
   * Handles sending custom (user-created, DB-stored) email templates.
   * Placeholders in the template are substituted using variableMapping.
   */
  private async handleCustomTemplateEmail(
    templateId: string,
    recipients: AutomationResolvedRecipient[],
    isUserDefault: boolean,
    languageOverride?: string,
    variableMapping: Record<string, string> = {},
  ) {
    // When language is fixed (not user_default), fetch template once for all recipients
    if (!isUserDefault) {
      const template = await this.templateService.getTemplate(
        templateId,
        languageOverride as SupportedLanguages | undefined,
      );

      if (!template) {
        this.logger.error(`Email template not found: ${templateId}`);
        return;
      }

      for (const recipient of recipients) {
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

        await this.emailService.sendEmailWithLogo(
          {
            to: recipient.userEmail,
            subject: renderedSubject,
            text: renderedSubject,
            html: renderedBody,
          },
          { tenantId: recipient.tenantId },
        );

        this.logger.debug(
          `[Automation] Sent custom email to ${recipient.userEmail}: subject="${renderedSubject}"`,
        );
      }
    } else {
      // Resolve language per recipient from their user settings
      for (const recipient of recipients) {
        const recipientLanguage = await this.resolveRecipientLanguage(recipient.userId);

        const template = await this.templateService.getTemplate(templateId, recipientLanguage);

        if (!template) {
          this.logger.error(`Email template not found: ${templateId} (lang: ${recipientLanguage})`);
          continue;
        }

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

        await this.emailService.sendEmailWithLogo(
          {
            to: recipient.userEmail,
            subject: renderedSubject,
            text: renderedSubject,
            html: renderedBody,
          },
          { tenantId: recipient.tenantId },
        );

        this.logger.debug(
          `[Automation] Sent custom email to ${recipient.userEmail} (lang: ${recipientLanguage}): subject="${renderedSubject}"`,
        );
      }
    }
  }

  /**
   * Resolves the preferred language for a recipient from their user settings.
   * Falls back to "en" if settings cannot be retrieved.
   */
  private async resolveRecipientLanguage(userId?: UUIDType): Promise<SupportedLanguages> {
    if (!userId) return "en";

    try {
      const userSettings = await this.settingsService.getUserSettings(userId, this.dbAdmin);
      return userSettings.language ?? "en";
    } catch {
      this.logger.debug(`Could not resolve language for user ${userId}, defaulting to "en"`);
      return "en";
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
