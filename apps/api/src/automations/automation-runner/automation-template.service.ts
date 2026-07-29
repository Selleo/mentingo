import { Injectable, Logger } from "@nestjs/common";

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

  constructor(private readonly emailTemplatesService: EmailNotificationTemplatesService) {}

  async getTemplate(
    templateId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<AutomationEmailTemplate | null> {
    this.logger.debug(`Fetching email template: ${templateId}`);

    try {
      const template = await this.emailTemplatesService.getTemplateById(templateId);

      if (!template) {
        this.logger.warn(`Email template not found: ${templateId}`);
        return null;
      }

      const resolvedLanguage = language ?? template.baseLanguage;

      const rendered = await renderTemplateContent({
        blocks: template.blocks,
        strings: template.strings,
        subject: template.subject,
        language: resolvedLanguage,
        baseLanguage: template.baseLanguage,
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
