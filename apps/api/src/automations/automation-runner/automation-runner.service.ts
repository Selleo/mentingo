import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import Handlebars from "handlebars";

import { AutomationStepType } from "src/announcements/types/automations.types";
import { type UUIDType, DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { SettingsService } from "src/settings/settings.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";
import { AutomationsService } from "../automations.service";
import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

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
    private readonly automationService: AutomationsService,
    private readonly automationLogsRepository: AutomationLogsRepository,
    private readonly tenantRunner: TenantDbRunnerService,

    @Inject(DB_ADMIN)
    private readonly dbAdmin: DatabasePg,
  ) {}

  async startAutomation(automationId: UUIDType, event: AutomationEventTypes) {
    const automationSteps = await this.automationStepsService.getAllAutomationSteps(automationId);

    const resolvedRecipients = await this.dataResolver.resolve(event);

    const automationToRun = await this.automationService.getAutomationById(automationId);

    const emails = resolvedRecipients.map((recipient) => recipient.userEmail);

    const tenantId = automationSteps[0].tenantId;

    console.log(automationId);

    if (resolvedRecipients.length === 0) {
      this.logger.warn(
        `No recipients resolved for automation ${automationId} (event: ${event.constructor.name})`,
      );
      return;
    }

    try {
      await this.executeAutomationSteps(automationSteps, resolvedRecipients);
    } catch (error: any) {
      this.tenantRunner.runWithTenant(tenantId, async () => {
        await this.automationLogsRepository.create({
          status: "failed",
          automationId: automationToRun.id,
          automationName: automationToRun.name.en ?? "Unknown",
          eventName: event.constructor.name,
          emailAddresses: emails,
          errorName: error.name,
        });
      });

      return;
    }
    this.tenantRunner.runWithTenant(tenantId, async () => {
      await this.automationLogsRepository.create({
        status: "success",
        automationId: automationToRun.id,
        automationName: automationToRun.name.en ?? "Unknown",
        eventName: event.constructor.name,
        emailAddresses: emails,
      });
    });
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
    const config = (actionContext as unknown as { config?: Record<string, unknown> }).config;
    const templateId = actionContext.templateId ?? (config?.emailTemplate as string | undefined);
    const language = actionContext.language ?? (config?.language as string | undefined);
    const variableMapping =
      actionContext.variableMapping ??
      (config?.placeholderValues as Record<string, string> | undefined) ??
      {};

    if (!templateId) {
      this.logger.error("Email template not found: templateId is missing from action context");
      return;
    }

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

  private async handleCustomTemplateEmail(
    templateId: string,
    recipients: AutomationResolvedRecipient[],
    isUserDefault: boolean,
    languageOverride?: string,
    variableMapping: Record<string, string> = {},
  ) {
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

  private replacePlaceholders(
    templateContent: string,
    variableMapping: Record<string, string>,
    resolvedVariables: Record<string, string>,
  ): string {
    const context: Record<string, string> = {};

    for (const [placeholder, variableKey] of Object.entries(variableMapping)) {
      const cleanKey = placeholder.replace(/^\{\{\s*|\s*\}\}$/g, "");
      context[cleanKey] = resolvedVariables[variableKey] ?? "";
    }

    const template = Handlebars.compile(templateContent, { noEscape: true });
    return template(context);
  }
}
