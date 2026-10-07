import { Inject, Injectable } from "@nestjs/common";
import { getUsedEmailTemplateVariables } from "@repo/email-templates";
import {
  AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS,
  AUTOMATION_EMAIL_DELIVERY_STATUSES,
  SUPPORTED_LANGUAGES,
  type AutomationPlaceholderValue,
} from "@repo/shared";

import {
  NOTIFICATION_ACCOUNT_ACTION_PREPARATION,
  AUTOMATION_EMAIL_DELIVERY_REASON_CODES,
} from "src/automation-execution/automation-execution.constants";
import { findAutomationEventDefinition } from "src/automations/catalog/automation-event-catalog";
import {
  getAccountActionPlaceholderNames,
  resolveAutomationMappings,
} from "src/automations/mappers/automation-mapping";
import { EmailService } from "src/common/emails/emails.service";
import { EmailTemplateRenderingService } from "src/email-templates/services/email-template-rendering.service";
import { EmailTemplateValidationService } from "src/email-templates/services/email-template-validation.service";

import {
  NotificationAccountActionPreparation,
  type ClaimedAutomationEmailDelivery,
  type AutomationEmailDeliveryRecord,
} from "../automation-execution.types";

import { AutomationEmailDeliveryStateService } from "./automation-email-delivery-state.service";

import type { UUIDType } from "src/common";

@Injectable()
export class AutomationEmailDeliveryService {
  constructor(
    private readonly automationEmailDeliveryStateService: AutomationEmailDeliveryStateService,
    private readonly emailTemplateRenderingService: EmailTemplateRenderingService,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
    private readonly emailService: EmailService,
    @Inject(NOTIFICATION_ACCOUNT_ACTION_PREPARATION)
    private readonly notificationAccountActionService: NotificationAccountActionPreparation,
  ) {}

  async sendAutomationEmail(emailDeliveryId: UUIDType, tenantId: UUIDType): Promise<void> {
    const claim =
      await this.automationEmailDeliveryStateService.claimAutomationEmailDelivery(emailDeliveryId);

    if (!claim) {
      return;
    }

    const { delivery } = claim;

    try {
      const fields = await this.prepareAutomationRecipientFields(claim);

      if (!fields) {
        await this.automationEmailDeliveryStateService.recordAutomationEmailDeliveryResult(
          delivery.id,
          AUTOMATION_EMAIL_DELIVERY_STATUSES.SKIPPED,
          AUTOMATION_EMAIL_DELIVERY_REASON_CODES.ACCOUNT_ACTION_EXPIRED_OR_REVOKED,
          undefined,
          delivery.attemptCount,
        );

        return;
      }

      const rendered = await this.renderAutomationEmail(claim, fields, tenantId);

      await this.emailService.sendEmailWithLogo(
        {
          to: delivery.recipientEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          attachments: rendered.attachments,
        },
        { tenantId: tenantId },
      );

      await this.automationEmailDeliveryStateService.recordAutomationEmailDeliveryResult(
        delivery.id,
        AUTOMATION_EMAIL_DELIVERY_STATUSES.SUCCEEDED,
        null,
        rendered.language,
        delivery.attemptCount,
      );
    } catch {
      await this.recordFailedDeliveryAttempt(delivery);
    }
  }

  private async recordFailedDeliveryAttempt(
    delivery: AutomationEmailDeliveryRecord,
  ): Promise<void> {
    const attemptsExhausted = delivery.attemptCount >= AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS;

    // Provider errors can contain credentials or message bodies. Store a fixed reasonCode.
    const outcome =
      await this.automationEmailDeliveryStateService.recordAutomationEmailDeliveryResult(
        delivery.id,
        attemptsExhausted
          ? AUTOMATION_EMAIL_DELIVERY_STATUSES.FAILED
          : AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING,
        AUTOMATION_EMAIL_DELIVERY_REASON_CODES.EMAIL_ACTION_FAILED,
        undefined,
        delivery.attemptCount,
      );

    if (outcome === AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING) {
      throw new Error("Automation email action failed; retry requested");
    }
  }

  private async prepareAutomationRecipientFields({
    delivery,
  }: ClaimedAutomationEmailDelivery): Promise<Record<string, AutomationPlaceholderValue> | null> {
    const fields = { ...(delivery.eventFields ?? {}) };

    if (!delivery.accountActionIntentId) {
      return fields;
    }

    const accountActionFields =
      await this.notificationAccountActionService.prepareNotificationAccountActionFields(
        delivery.accountActionIntentId,
      );

    if (!accountActionFields) {
      return null;
    }

    return { ...fields, ...accountActionFields };
  }

  private async renderAutomationEmail(
    { delivery, run, step, publication }: ClaimedAutomationEmailDelivery,
    fields: Record<string, AutomationPlaceholderValue>,
    tenantId: UUIDType,
  ) {
    const requestedLanguage = delivery.language ?? SUPPORTED_LANGUAGES.EN;

    const language = this.emailTemplateValidationService.resolveEmailTemplateLanguage(
      publication.subject,
      publication.content,
      requestedLanguage,
      publication.baseLanguage,
    );

    const mappings = step.config.mappings ?? {};
    const event = findAutomationEventDefinition(run.eventKind);

    const sensitivePlaceholderKeys = event ? getAccountActionPlaceholderNames(event, mappings) : [];

    const branding = await this.emailService.getDefaultEmailProperties(
      tenantId,
      undefined,
      language,
    );

    const variables = resolveAutomationMappings(
      mappings,
      fields,
      language,
      publication.baseLanguage,
      getUsedEmailTemplateVariables(
        { [language]: publication.subject[language] },
        { [language]: publication.content[language]! },
      ),
    );

    return this.emailTemplateRenderingService.renderEmailTemplatePublication(
      tenantId,
      publication,
      language,
      variables,
      { ...branding, logoUrl: "cid:logo", borderCircleUrl: "cid:border-circle" },
      { sensitivePlaceholderKeys },
    );
  }
}
