import { Injectable } from "@nestjs/common";

import { EmailService } from "src/common/emails/emails.service";
import { QUEUE_NAMES, QueueService } from "src/queue";

import { EmailTemplateManagementService } from "./email-template-management.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type { EmailTemplateTestJobData } from "../email-template.types";
import type { PreviewEmailTemplateBody } from "../schemas/email-template.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class EmailTemplateTestDeliveryService {
  constructor(
    private readonly queueService: QueueService,
    private readonly emailTemplateManagementService: EmailTemplateManagementService,
    private readonly emailService: EmailService,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
  ) {}

  async enqueueEmailTemplateTest(body: PreviewEmailTemplateBody, currentUser: CurrentUserType) {
    const placeholders = body.placeholders ?? [];

    this.emailTemplateValidationService.assertValidEmailTemplateDraft(
      placeholders,
      body.subject,
      body.content,
    );

    const language = this.emailTemplateValidationService.resolveEmailTemplateLanguage(
      body.subject,
      body.content,
      body.language,
      body.baseLanguage,
    );

    this.emailTemplateValidationService.assertEmailTemplateVariableValues(
      placeholders,
      body.content[language]!,
      this.emailTemplateValidationService.buildSafeEmailPreviewVariables(placeholders, language),
      body.subject[language]!,
    );

    const job = await this.queueService.enqueue<EmailTemplateTestJobData>(
      QUEUE_NAMES.EMAIL_TEMPLATE_TEST,
      QUEUE_NAMES.EMAIL_TEMPLATE_TEST,
      {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
        recipient: currentUser.email,
        body,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    return { jobId: String(job.id) };
  }

  async sendTestEmailTemplate(data: EmailTemplateTestJobData) {
    const { subject, text, html, attachments } =
      await this.emailTemplateManagementService.renderSampleEmailTemplate(
        data.body,
        data.tenantId,
        data.userId,
      );

    await this.emailService.sendEmailWithLogo(
      { to: data.recipient, subject, text, html, attachments },
      { tenantId: data.tenantId },
    );
  }
}
