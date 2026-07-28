import { Injectable, Logger } from "@nestjs/common";

import { EmailNotificationTemplatesService } from "src/email-notification-templates/email-templates.service";
import { renderTemplateContent } from "src/email-notification-templates/utils/renderTemplateContent";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

/**
 * Represents a resolved email template ready for placeholder substitution.
 */
export type AutomationEmailTemplate = {
  id: UUIDType;
  /** Email subject line — may contain placeholders like {{recipient_name}} */
  subject: string;
  /** Email body (HTML) — may contain placeholders like {{recipient_name}}, {{course_title}} */
  body: string;
};

/**
 * Service responsible for fetching user-created email templates
 * from the database and rendering them for automation execution.
 */
@Injectable()
export class AutomationTemplateService {
  private readonly logger = new Logger(AutomationTemplateService.name);

  constructor(private readonly emailTemplatesService: EmailNotificationTemplatesService) {}

  /**
   * Fetches a user-created email template by ID and renders it to HTML
   * for the given language. Placeholders ({{variable}}) are preserved in
   * the rendered output so the runner can substitute them with actual values.
   *
   * @param templateId - UUID of the template to fetch
   * @param language - Language to render the template in (defaults to template's base language)
   * @returns The rendered template with subject and body, or null if not found
   */
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

      // Render the template to HTML while preserving {{variable}} placeholders
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
