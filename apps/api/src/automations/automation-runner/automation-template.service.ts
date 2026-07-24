import { Injectable, Logger } from "@nestjs/common";

import type { UUIDType } from "src/common";

/**
 * Represents a user-created email template stored in the database.
 */
export type AutomationEmailTemplate = {
  id: UUIDType;
  /** Email subject line — may contain placeholders like {{recipient_name}} */
  subject: string;
  /** Email body (HTML) — may contain placeholders like {{recipient_name}}, {{course_title}} */
  body: string;
};

/**
 * Service responsible for fetching user-created email templates.
 *
 * TODO: Replace mock implementation with actual database queries
 * once the email templates entity/table is created.
 */
@Injectable()
export class AutomationTemplateService {
  private readonly logger = new Logger(AutomationTemplateService.name);

  /**
   * Fetches a user-created email template by ID.
   *
   * @param templateId - UUID of the template to fetch
   * @returns The template or null if not found
   *
   * TODO: Replace with actual repository call, e.g.:
   * ```
   * return this.automationTemplatesRepository.getById(templateId);
   * ```
   */
  async getTemplate(templateId: UUIDType): Promise<AutomationEmailTemplate | null> {
    this.logger.debug(`Fetching email template: ${templateId}`);

    // ──────────────────────────────────────────────────────────────────
    // MOCK: Return a placeholder template for development/testing.
    // Replace this with a real database lookup when the templates
    // table/entity is ready.
    // ──────────────────────────────────────────────────────────────────
    return {
      id: templateId,
      subject: "Mock template subject — {{recipient_name}}",
      body: `
        <h1>Hello {{recipient_name}}</h1>
        <p>This is a mock automation email template.</p>
        <p>Course: {{course_title}}</p>
        <a href="{{link}}">Click here</a>
      `.trim(),
    };
  }
}
