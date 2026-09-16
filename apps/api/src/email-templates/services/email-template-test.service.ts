import { Injectable } from "@nestjs/common";

import { EmailService } from "src/common/emails/emails.service";
import { QUEUE_NAMES, QueueService } from "src/queue";

import { EmailTemplateValidationService } from "./email-template-validation.service";
import { EmailTemplateService } from "./email-template.service";

import type { EmailTemplateTestJobData } from "../email-template.types";
import type { PreviewEmailTemplateBody } from "../schemas/email-template.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class EmailTemplateTestService {
  constructor(
    private readonly queueService: QueueService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailService: EmailService,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
  ) {}

  async enqueueTestEmailTemplate(body: PreviewEmailTemplateBody, currentUser: CurrentUserType) {
    this.emailTemplateValidationService.validateDraft(body.event, body.subject, body.content);
    const language = this.emailTemplateValidationService.resolveEmailTemplateLanguage(
      body.subject,
      body.content,
      body.language,
      body.baseLanguage,
    );
    this.emailTemplateValidationService.validateRuntimeVariables(
      body.event,
      body.content[language]!,
      this.emailTemplateValidationService.getSampleVariables(body.event),
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
      await this.emailTemplateService.renderSampleEmailTemplate(
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
