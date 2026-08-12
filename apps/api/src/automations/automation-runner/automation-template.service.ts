import { Injectable, Logger } from "@nestjs/common";
import { DEFAULT_TENANT_PRIMARY_COLOR, TENANT_LOGO_CID_SRC } from "@repo/shared";

import { EmailService } from "src/common/emails/emails.service";
import { EmailNotificationTemplatesService } from "src/email-notification-templates/email-templates.service";
import { renderTemplateContent } from "src/email-notification-templates/utils/renderTemplateContent";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type AutomationEmailTemplate = {
  id: UUIDType;
  subject: string;
  body: string;
};

@Injectable()
export class AutomationTemplateService {
  private readonly logger = new Logger(AutomationTemplateService.name);

  constructor(
    private readonly emailTemplatesService: EmailNotificationTemplatesService,
    private readonly emailService: EmailService,
  ) {}

  async getTemplate(
    templateId: UUIDType,
    language?: SupportedLanguages,
    tenantId?: UUIDType,
  ): Promise<AutomationEmailTemplate | null> {
    this.logger.debug(`Fetching email template: ${templateId}`);

    try {
      const template = await this.emailTemplatesService.getTemplateById(templateId);

      if (!template) {
        this.logger.warn(`Email template not found: ${templateId}`);
        return null;
      }

      const resolvedLanguage = language ?? template.baseLanguage;
      const primaryColor = tenantId
        ? (await this.emailService.getDefaultEmailProperties(tenantId)).primaryColor
        : DEFAULT_TENANT_PRIMARY_COLOR;

      const rendered = await renderTemplateContent({
        blocks: template.blocks,
        strings: template.strings,
        subject: template.subject,
        language: resolvedLanguage,
        baseLanguage: template.baseLanguage,
        primaryColor,
        tenantLogoSrc: TENANT_LOGO_CID_SRC,
      });

      return {
        id: templateId,
        subject: rendered.subject,
        body: rendered.html,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch/render email template ${templateId}`, error);
      return null;
    }
  }
}
