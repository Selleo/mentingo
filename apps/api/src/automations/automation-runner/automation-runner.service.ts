import { createHash } from "node:crypto";

import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { load } from "cheerio";
import Handlebars from "handlebars";

import { AutomationStepType } from "src/announcements/types/automations.types";
import { type UUIDType, DatabasePg } from "src/common";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { SettingsService } from "src/settings/settings.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";
import { AutomationsService } from "../automations.service";
import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

import { AutomationDataResolverService } from "./automation-data-resolver.service";
import { AUTOMATION_EMAIL_DELIVERY_JOB_NAME } from "./automation-email-delivery.worker";
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

type AutomationLanguage = SupportedLanguages | typeof USER_DEFAULT_LANGUAGE;

type DeliverySummary = {
  sent: number;
  failed: number;
};

type DeliveryContext = {
  automationId: UUIDType;
  automationName: string;
  eventName: string;
  eventKey: string;
};

const EMPTY_DELIVERY_SUMMARY: DeliverySummary = { sent: 0, failed: 0 };

@Injectable()
export class AutomationRunnerService {
  private readonly logger = new Logger(AutomationRunnerService.name);

  constructor(
    private readonly automationStepsService: AutomationStepsService,
    private readonly dataResolver: AutomationDataResolverService,
    private readonly templateService: AutomationTemplateService,
    private readonly systemTemplateRenderer: AutomationSystemTemplateRendererService,
    private readonly queueService: QueueService,
    private readonly settingsService: SettingsService,
    private readonly automationService: AutomationsService,
    private readonly automationLogsRepository: AutomationLogsRepository,
    private readonly tenantRunner: TenantDbRunnerService,

    @Inject(DB_ADMIN)
    private readonly dbAdmin: DatabasePg,
  ) {}

  async startAutomation(automationId: UUIDType, event: AutomationEventTypes) {
    const automationToRun = await this.automationService.getAutomationById(automationId);
    const tenantId = automationToRun.tenantId;
    const automationSteps = await this.automationStepsService.getAllAutomationSteps(automationId);

    if (automationToRun.status !== "enabled") {
      await this.writeAutomationLog(tenantId, {
        status: "skipped",
        automationId: automationToRun.id,
        automationName: Object.values(automationToRun.name)[0] ?? "Unknown",
        eventName: event.constructor.name,
        emailAddresses: [],
        errorName: `Automation status is ${automationToRun.status}`,
      });
      return;
    }

    if (automationSteps.length === 0) {
      await this.writeAutomationLog(tenantId, {
        status: "skipped",
        automationId: automationToRun.id,
        automationName: Object.values(automationToRun.name)[0] ?? "Unknown",
        eventName: event.constructor.name,
        emailAddresses: [],
        errorName: "Automation has no steps",
      });
      return;
    }

    const resolvedRecipients = await this.dataResolver.resolve(event);
    const emails = resolvedRecipients.map((recipient) => recipient.userEmail);

    if (resolvedRecipients.length === 0) {
      this.logger.warn(
        `No recipients resolved for automation ${automationId} (event: ${event.constructor.name})`,
      );
      return;
    }

    try {
      const delivery = await this.executeAutomationSteps(automationSteps, resolvedRecipients, {
        automationId: automationToRun.id,
        automationName: Object.values(automationToRun.name)[0] ?? "Unknown",
        eventName: event.constructor.name,
        eventKey: createHash("sha256")
          .update(JSON.stringify(event))
          .digest("hex")
          .slice(0, 24),
      });
      if (delivery.failed > 0) {
        await this.writeAutomationLog(tenantId, {
          status: "failed",
          automationId: automationToRun.id,
          automationName: Object.values(automationToRun.name)[0] ?? "Unknown",
          eventName: event.constructor.name,
          emailAddresses: emails,
          errorName: `Email delivery failed for ${delivery.failed} of ${resolvedRecipients.length} recipients`,
        });
        return;
      }
    } catch (error: unknown) {
      await this.writeAutomationLog(tenantId, {
        status: "failed",
        automationId: automationToRun.id,
        automationName: Object.values(automationToRun.name)[0] ?? "Unknown",
        eventName: event.constructor.name,
        emailAddresses: emails,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });

      return;
    }
    await this.writeAutomationLog(tenantId, {
      status: "success",
      automationId: automationToRun.id,
      automationName: Object.values(automationToRun.name)[0] ?? "Unknown",
      eventName: event.constructor.name,
      emailAddresses: emails,
    });
  }

  private async writeAutomationLog(
    tenantId: UUIDType,
    input: Parameters<AutomationLogsRepository["create"]>[0],
  ) {
    await this.tenantRunner.runWithTenant(tenantId, () => this.automationLogsRepository.create(input));
  }

  private async executeAutomationSteps(
    steps: AutomationStep[],
    recipients: AutomationResolvedRecipient[],
    context: DeliveryContext,
  ): Promise<DeliverySummary> {
    const roots = steps.filter((step) => step.parentId === null);
    const root = roots[0];

    if (roots.length !== 1 || !root) {
      throw new BadRequestException("automationSteps.toast.stepTreeBuildFailed");
    }

    const stepIds = new Set(steps.map((step) => step.id));
    if (steps.some((step) => step.parentId !== null && !stepIds.has(step.parentId))) {
      throw new BadRequestException("automationSteps.toast.missingParent");
    }

    return this.executeStep(root, steps, recipients, context);
  }

  private async executeStep(
    step: AutomationStep,
    steps: AutomationStep[],
    recipients: AutomationResolvedRecipient[],
    context: DeliveryContext,
  ): Promise<DeliverySummary> {
    const summary = await this.executeSingleStep(step, recipients, context);

    const children = steps.filter((child) => child.parentId === step.id);

    for (const child of children) {
      const childSummary = await this.executeStep(child, steps, recipients, context);
      summary.sent += childSummary.sent;
      summary.failed += childSummary.failed;
    }

    return summary;
  }

  private async executeSingleStep(
    step: AutomationStep,
    recipients: AutomationResolvedRecipient[],
    context: DeliveryContext,
  ): Promise<DeliverySummary> {
    switch (step.type) {
      case AutomationStepType.Trigger:
        this.logger.debug(`Trigger: ${JSON.stringify(step.typeContext)}`);
        return { ...EMPTY_DELIVERY_SUMMARY };

      case AutomationStepType.Condition:
        this.logger.debug(`Condition: ${JSON.stringify(step.typeContext)}`);
        return { ...EMPTY_DELIVERY_SUMMARY };

      case AutomationStepType.Action:
        return this.handleAction(step.typeContext as TypeContext, recipients, context);

      default:
        throw new BadRequestException(`Unknown step type ${step.type}`);
    }
  }

  private async handleAction(
    actionContext: TypeContext,
    recipients: AutomationResolvedRecipient[],
    context: DeliveryContext,
  ): Promise<DeliverySummary> {
    switch (actionContext.name) {
      case "send_email":
        return this.handleSendEmailAction(actionContext as SendEmailActionContext, recipients, context);
      default:
        this.logger.warn(`Unknown action: ${actionContext.name}`);
        return { ...EMPTY_DELIVERY_SUMMARY };
    }
  }

  private async handleSendEmailAction(
    actionContext: SendEmailActionContext,
    recipients: AutomationResolvedRecipient[],
    context: DeliveryContext,
  ): Promise<DeliverySummary> {
    const config = (actionContext as unknown as { config?: Record<string, unknown> }).config;
    const templateId = actionContext.templateId ?? (config?.emailTemplate as string | undefined);
    const language = this.resolveAutomationLanguage(actionContext.language ?? config?.language);
    const variableMapping =
      actionContext.variableMapping ??
      (config?.placeholderValues as Record<string, string> | undefined) ??
      {};

    if (!templateId) {
      this.logger.error("Email template not found: templateId is missing from action context");
      return { sent: 0, failed: recipients.length };
    }

    const isUserDefault = language === USER_DEFAULT_LANGUAGE;

    if (isSystemTemplateId(templateId)) {
      return this.handleSystemTemplateEmail(templateId, recipients, isUserDefault, language, context);
    } else {
      return this.handleCustomTemplateEmail(
        templateId,
        recipients,
        isUserDefault,
        language,
        variableMapping,
        context,
      );
    }
  }

  private async handleSystemTemplateEmail(
    templateId: string,
    recipients: AutomationResolvedRecipient[],
    isUserDefault: boolean,
    languageOverride?: AutomationLanguage,
    context?: DeliveryContext,
  ): Promise<DeliverySummary> {
    const summary = { sent: 0, failed: 0 };

    for (const recipient of recipients) {
      try {
        const recipientLanguage = isUserDefault
          ? await this.resolveRecipientLanguage(recipient.userId)
          : languageOverride === USER_DEFAULT_LANGUAGE
            ? undefined
            : languageOverride;

        const rendered = await this.systemTemplateRenderer.render(
          templateId,
          recipient.variables,
          recipient.tenantId,
          recipient.userId,
          recipientLanguage,
        );

        if (!rendered) {
          throw new Error(`System template render failed: ${templateId}`);
        }

        await this.enqueueEmailDelivery(
          recipient,
          rendered.subject,
          rendered.text,
          rendered.html,
          context,
        );
        summary.sent++;
      } catch (error: unknown) {
        summary.failed++;
        this.logger.error(
          `Automation system email failed for ${recipient.userEmail}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return summary;
  }

  private async handleCustomTemplateEmail(
    templateId: string,
    recipients: AutomationResolvedRecipient[],
    isUserDefault: boolean,
    languageOverride?: AutomationLanguage,
    variableMapping: Record<string, string> = {},
    context?: DeliveryContext,
  ): Promise<DeliverySummary> {
    const summary = { sent: 0, failed: 0 };

    if (!isUserDefault) {
      const template = await this.templateService.getTemplate(
        templateId,
        languageOverride === USER_DEFAULT_LANGUAGE ? undefined : languageOverride,
        recipients[0]?.tenantId,
      );
      if (!template) {
        this.logger.error(`Email template not found: ${templateId}`);
        return { sent: 0, failed: recipients.length };
      }

      for (const recipient of recipients) {
        try {
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
          await this.enqueueEmailDelivery(
            recipient,
            renderedSubject,
            this.toPlainText(renderedBody),
            renderedBody,
            context,
          );
          summary.sent++;
        } catch (error: unknown) {
          summary.failed++;
          this.logger.error(
            `Automation custom email failed for ${recipient.userEmail}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    } else {
      for (const recipient of recipients) {
        const recipientLanguage = await this.resolveRecipientLanguage(recipient.userId);

        const template = await this.templateService.getTemplate(
          templateId,
          recipientLanguage,
          recipient.tenantId,
        );

        if (!template) {
          this.logger.error(`Email template not found: ${templateId} (lang: ${recipientLanguage})`);
          summary.failed++;
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

        try {
          await this.enqueueEmailDelivery(
            recipient,
            renderedSubject,
            this.toPlainText(renderedBody),
            renderedBody,
            context,
          );
          summary.sent++;
        } catch (error: unknown) {
          summary.failed++;
          this.logger.error(
            `Automation custom email failed for ${recipient.userEmail}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    }

    return summary;
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

  private resolveAutomationLanguage(value: unknown): AutomationLanguage | undefined {
    if (value === USER_DEFAULT_LANGUAGE) return USER_DEFAULT_LANGUAGE;
    if (typeof value !== "string") return undefined;

    return Object.values(SUPPORTED_LANGUAGES).find((supportedLanguage) => supportedLanguage === value);
  }

  private async enqueueEmailDelivery(
    recipient: AutomationResolvedRecipient,
    subject: string,
    text: string,
    html: string,
    context?: DeliveryContext,
  ) {
    if (!context) {
      throw new Error("Automation delivery context is required");
    }

    const recipientKey = createHash("sha256")
      .update(recipient.userId ?? recipient.userEmail)
      .digest("hex")
      .slice(0, 24);

    await this.queueService.enqueue(
      QUEUE_NAMES.AUTOMATION_EMAIL_DELIVERY,
      AUTOMATION_EMAIL_DELIVERY_JOB_NAME,
      {
        tenantId: recipient.tenantId,
        automationId: context.automationId,
        automationName: context.automationName,
        eventName: context.eventName,
        recipientEmail: recipient.userEmail,
        subject,
        text,
        html,
      },
      {
        jobId: `automation-${context.automationId}-${context.eventKey}-${recipientKey}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 86_400, count: 10_000 },
        removeOnFail: false,
      },
    );
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

  private toPlainText(html: string) {
    return load(html).root().text().replace(/\s+/g, " ").trim();
  }
}
