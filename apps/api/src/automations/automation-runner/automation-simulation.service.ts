import { Injectable, Logger } from "@nestjs/common";
import { getStepDefinition, type SupportedLanguages, type TriggerType } from "@repo/shared";

import { CORS_ORIGIN } from "src/auth/consts";

import { AutomationSystemTemplatePreviewService } from "./automation-system-template-preview.service";
import { AutomationTemplateService } from "./automation-template.service";

import type {
  EmailPreview,
  EventDataField,
  NodeValidationResult,
  PlaceholderMappingEntry,
  RunSimulationBody,
  SimulationNodeDto,
  SimulationResult,
  ValidationError,
} from "./automation-simulation.types";

const SYSTEM_TEMPLATE_PLACEHOLDERS: Record<string, string[]> = {
  user_invite: ["invitedByUserName", "createPasswordLink"],
  welcome: ["coursesLink"],
  user_first_login: ["name", "coursesUrl"],
  user_assigned_to_course: ["courseName", "courseLink", "formatedCourseDueDate"],
  user_short_inactivity: ["courseName", "courseLink"],
  user_long_inactivity: ["courseName", "courseLink"],
  user_finished_chapter: ["chapterName", "courseName", "courseLink"],
  user_finished_course: ["courseName", "buttonLink", "hasCertificate"],
  create_password_reminder: ["createPasswordLink"],
  certificate_expiration_warning: ["courseName", "courseLink", "expiresAt"],
  certificate_expired: ["courseName", "courseLink"],
  announcement: ["title", "content", "buttonLink"],
  course_due_date_reminder: ["courseName", "courseLink", "dueDate", "daysBeforeDueDate"],
  new_user: ["userName", "profileLink"],
  finished_course: ["userName", "courseName", "progressLink"],
};

@Injectable()
export class AutomationSimulationService {
  private readonly logger = new Logger(AutomationSimulationService.name);

  constructor(
    private readonly systemTemplatePreviewService: AutomationSystemTemplatePreviewService,
    private readonly templateService: AutomationTemplateService,
  ) {}

  async runSimulation(body: RunSimulationBody): Promise<SimulationResult> {
    const { nodes, language } = body;

    const { nodeResults, overallStatus, eventData, placeholderMappings, sampleValues } =
      this.validateNodes(nodes, language);

    const emailPreviews: EmailPreview[] = [];

    if (overallStatus === "success") {
      const actionNodes = nodes.filter((n) => n.kind === "action");

      for (const action of actionNodes) {
        const preview = await this.buildEmailPreview(action, sampleValues, language);
        emailPreviews.push(preview);
      }
    }

    return {
      overallStatus,
      nodeResults,
      eventData,
      placeholderMappings,
      emailPreviews,
    };
  }

  private validateNodes(
    nodes: SimulationNodeDto[],
    language: string,
  ): {
    nodeResults: NodeValidationResult[];
    overallStatus: "success" | "failed";
    eventData: EventDataField[];
    placeholderMappings: Record<string, PlaceholderMappingEntry[]>;
    sampleValues: Record<string, string>;
  } {
    const sampleValues = this.getSampleValues(language);
    const triggerNode = nodes.find((n) => n.kind === "trigger");
    const actionNodes = nodes.filter((n) => n.kind === "action");

    const nodeResults: NodeValidationResult[] = [];

    if (triggerNode) {
      const triggerErrors: ValidationError[] = [];

      if (!triggerNode.type) {
        triggerErrors.push({
          nodeId: triggerNode.id,
          nodeName: triggerNode.label || "Trigger",
          field: "type",
          description: this.t("selectTriggerType", language),
        });
      }

      nodeResults.push({
        nodeId: triggerNode.id,
        nodeName: triggerNode.label || "Trigger",
        kind: "trigger",
        status: triggerErrors.length > 0 ? "invalid" : "valid",
        errors: triggerErrors,
      });
    } else {
      nodeResults.push({
        nodeId: "missing-trigger",
        nodeName: "Trigger",
        kind: "trigger",
        status: "invalid",
        errors: [
          {
            nodeId: "missing-trigger",
            nodeName: "Trigger",
            field: "trigger",
            description: this.t("addTriggerNode", language),
          },
        ],
      });
    }

    for (const action of actionNodes) {
      const actionErrors: ValidationError[] = [];

      if (!action.config.emailTemplate) {
        actionErrors.push({
          nodeId: action.id,
          nodeName: action.label || "Akcja",
          field: "emailTemplate",
          description: this.t("selectEmailTemplate", language),
        });
      }

      if (!action.config.language) {
        actionErrors.push({
          nodeId: action.id,
          nodeName: action.label || "Akcja",
          field: "language",
          description: this.t("selectLanguage", language),
        });
      }

      const selectedTemplate = action.config.emailTemplate as string | undefined;
      if (selectedTemplate && !(selectedTemplate in SYSTEM_TEMPLATE_PLACEHOLDERS)) {
        const placeholderValues = (action.config.placeholderValues as Record<string, string>) ?? {};
        const unmappedPlaceholders = Object.keys(placeholderValues).filter(
          (p) => !placeholderValues[p],
        );

        for (const placeholder of unmappedPlaceholders) {
          actionErrors.push({
            nodeId: action.id,
            nodeName: action.label || "Akcja",
            field: `placeholderValues.${placeholder}`,
            description: this.t("unmappedPlaceholder", language, { placeholder }),
          });
        }
      }

      nodeResults.push({
        nodeId: action.id,
        nodeName: action.label || "Akcja",
        kind: "action",
        status: actionErrors.length > 0 ? "invalid" : "valid",
        errors: actionErrors,
      });
    }

    if (actionNodes.length === 0) {
      nodeResults.push({
        nodeId: "missing-action",
        nodeName: "Akcja",
        kind: "action",
        status: "invalid",
        errors: [
          {
            nodeId: "missing-action",
            nodeName: "Akcja",
            field: "action",
            description: this.t("addActionNode", language),
          },
        ],
      });
    }

    const overallStatus = nodeResults.every((nr) => nr.status === "valid") ? "success" : "failed";

    const triggerDef = triggerNode ? getStepDefinition(triggerNode.type as TriggerType) : undefined;
    const eventData: EventDataField[] = (triggerDef?.providedVariables ?? []).map((v) => ({
      key: v.key,
      label: v.labelKey,
      dataType: v.dataType ?? "string",
    }));

    const placeholderMappings: Record<string, PlaceholderMappingEntry[]> = {};
    for (const action of actionNodes) {
      const values = (action.config.placeholderValues as Record<string, string>) ?? {};
      const entries: PlaceholderMappingEntry[] = Object.entries(values).map(
        ([placeholder, variable]) => ({
          placeholder,
          mappedVariable: variable || null,
          sampleValue: variable ? (sampleValues[variable] ?? null) : null,
        }),
      );
      if (entries.length > 0) {
        placeholderMappings[action.id] = entries;
      }
    }

    return { nodeResults, overallStatus, eventData, placeholderMappings, sampleValues };
  }

  private async buildEmailPreview(
    action: SimulationNodeDto,
    sampleValues: Record<string, string>,
    language: string,
  ): Promise<EmailPreview> {
    const selectedTemplate = action.config.emailTemplate as string | undefined;
    const selectedLanguage = (action.config.language as string) ?? language;
    const previewLanguage = selectedLanguage === "user_default" ? "en" : selectedLanguage;
    const placeholderValues = (action.config.placeholderValues as Record<string, string>) ?? {};

    const isCustomTemplate = selectedTemplate
      ? !(selectedTemplate in SYSTEM_TEMPLATE_PLACEHOLDERS) && selectedTemplate !== "default_email"
      : false;
    const recipientEmail = isCustomTemplate
      ? (sampleValues["user_email"] ?? sampleValues["userEmail"] ?? "jan.kowalski@example.com")
      : (sampleValues["userEmail"] ?? "jan.kowalski@example.com");

    let subject = `Preview: ${selectedTemplate ?? "default_email"}`;
    let htmlBody = this.buildFallbackHtml(selectedTemplate ?? "default_email");

    try {
      if (isCustomTemplate && selectedTemplate) {
        const preview = await this.renderCustomTemplatePreview(
          selectedTemplate,
          previewLanguage,
          placeholderValues,
          sampleValues,
        );
        if (preview) {
          subject = preview.subject;
          htmlBody = preview.html;
        }
      } else {
        const preview = await this.renderSystemTemplatePreview(
          selectedTemplate ?? "default_email",
          previewLanguage as SupportedLanguages,
        );
        if (preview) {
          subject = preview.subject;
          htmlBody = preview.html;
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to render email preview for node ${action.id}`, error);
    }

    return {
      nodeId: action.id,
      nodeName: action.label || "Akcja",
      subject,
      senderAddress: "noreply@mentingo.com",
      recipientAddress: recipientEmail,
      htmlBody,
    };
  }

  private async renderSystemTemplatePreview(
    templateId: string,
    language: SupportedLanguages,
  ): Promise<{ subject: string; html: string } | null> {
    return this.systemTemplatePreviewService.renderPreview(templateId, language);
  }

  private async renderCustomTemplatePreview(
    templateId: string,
    language: string,
    placeholderValues: Record<string, string>,
    sampleValues: Record<string, string>,
  ): Promise<{ subject: string; html: string } | null> {
    const template = await this.templateService.getTemplate(
      templateId,
      language as SupportedLanguages,
    );

    if (!template) return null;

    let subject = template.subject;
    let html = template.body;

    for (const [placeholder, variableKey] of Object.entries(placeholderValues)) {
      const sampleValue = sampleValues[variableKey] ?? variableKey;
      const regex = new RegExp(`\\{\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}\\}`, "g");
      subject = subject.replace(regex, sampleValue);
      html = html.replace(regex, sampleValue);
    }

    return { subject, html: this.replaceCidReferences(html) };
  }

  private getSampleValues(language: string): Record<string, string> {
    const isPolish = language === "pl";

    const urls: Record<string, string> = {
      course_url: "https://app.mentingo.com/courses/abc123",
      invite_link: "https://app.mentingo.com/invite/xyz",
      reset_password_link: "https://app.mentingo.com/reset/token123",
      platform_url: "https://app.mentingo.com",
      certificate_url: "https://app.mentingo.com/certificates/cert-001",
      announcement_url: "https://app.mentingo.com/announcements/1",
      chat_url: "https://app.mentingo.com/chat/msg-001",
      courseUrl: "https://app.mentingo.com/courses/abc123",
      inviteLink: "https://app.mentingo.com/invite/xyz",
      resetPasswordLink: "https://app.mentingo.com/reset/token123",
      platformUrl: "https://app.mentingo.com",
      certificateUrl: "https://app.mentingo.com/certificates/cert-001",
      announcementUrl: "https://app.mentingo.com/announcements/1",
      chatUrl: "https://app.mentingo.com/chat/msg-001",
      profileLink: "https://app.mentingo.com/profile/sample-user",
      progressLink: "https://app.mentingo.com/progress/abc123",
    };

    const dates: Record<string, string> = {
      due_date: "2025-08-15",
      login_date: "2025-07-22",
      finished_at: "2025-07-20",
      expiration_date: "2025-12-31",
      registration_date: "2025-06-01",
      created_at: "2025-06-01",
      dueDate: "2025-08-15",
      loginDate: "2025-07-22",
      finishedAt: "2025-07-20",
      expirationDate: "2025-12-31",
      registrationDate: "2025-06-01",
      archivedAt: "2025-07-01",
    };

    const textValues: Record<string, string> = isPolish
      ? {
          user_first_name: "Jan",
          user_last_name: "Kowalski",
          user_email: "jan.kowalski@example.com",
          course_name: "Szkolenie BHP 2025",
          chapter_name: "Rozdział 1: Wprowadzenie",
          certificate_name: "Certyfikat BHP",
          announcement_title: "Nowe szkolenie dostępne",
          announcement_content: "Zapraszamy na nowe szkolenie.",
          author_full_name: "Anna Nowak",
          message_content: "Cześć, sprawdź ten materiał!",
          days_left: "7",
          days_inactive: "14",
          userFirstName: "Jan",
          userLastName: "Kowalski",
          userEmail: "jan.kowalski@example.com",
          courseName: "Szkolenie BHP 2025",
          chapterName: "Rozdział 1: Wprowadzenie",
          certificateName: "Certyfikat BHP",
          announcementTitle: "Nowe szkolenie dostępne",
          announcementContent: "Zapraszamy na nowe szkolenie.",
          authorFullName: "Anna Nowak",
          messageContent: "Cześć, sprawdź ten materiał!",
          daysLeft: "7",
          daysInactive: "14",
          userName: "Jan Kowalski",
          invitedByUserName: "Anna Nowak",
          hasCertificate: "true",
          archiveReason: "expired",
        }
      : {
          user_first_name: "John",
          user_last_name: "Smith",
          user_email: "john.smith@example.com",
          course_name: "Health & Safety Training 2025",
          chapter_name: "Chapter 1: Introduction",
          certificate_name: "Safety Certificate",
          announcement_title: "New training available",
          announcement_content: "We invite you to a new training course.",
          author_full_name: "Jane Doe",
          message_content: "Hi, check out this material!",
          days_left: "7",
          days_inactive: "14",
          userFirstName: "John",
          userLastName: "Smith",
          userEmail: "john.smith@example.com",
          courseName: "Health & Safety Training 2025",
          chapterName: "Chapter 1: Introduction",
          certificateName: "Safety Certificate",
          announcementTitle: "New training available",
          announcementContent: "We invite you to a new training course.",
          authorFullName: "Jane Doe",
          messageContent: "Hi, check out this material!",
          daysLeft: "7",
          daysInactive: "14",
          userName: "John Smith",
          invitedByUserName: "Jane Doe",
          hasCertificate: "true",
          archiveReason: "expired",
        };

    return { ...urls, ...dates, ...textValues };
  }

  private t(key: string, language: string, params?: Record<string, string>): string {
    const translations: Record<string, Record<string, string>> = {
      selectTriggerType: {
        pl: "Wybierz typ triggera",
        en: "Select trigger type",
      },
      addTriggerNode: {
        pl: "Dodaj węzeł triggera",
        en: "Add a trigger node",
      },
      selectEmailTemplate: {
        pl: "Wybierz szablon e-mail",
        en: "Select email template",
      },
      selectLanguage: {
        pl: "Wybierz język",
        en: "Select language",
      },
      unmappedPlaceholder: {
        pl: `Niezmapowany placeholder: ${params?.placeholder ?? ""}`,
        en: `Unmapped placeholder: ${params?.placeholder ?? ""}`,
      },
      addActionNode: {
        pl: "Dodaj węzeł akcji",
        en: "Add an action node",
      },
    };

    const lang = language === "pl" ? "pl" : "en";
    return translations[key]?.[lang] ?? translations[key]?.["en"] ?? key;
  }

  private buildFallbackHtml(templateId: string): string {
    return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 12px; color: #92400e;">
          Podgląd szablonu systemowego: ${templateId}
        </p>
      </div>
      <p style="color: #4a4a4a; line-height: 1.6;">
        Treść e-mail zostanie wygenerowana na podstawie wybranego szablonu.
      </p>
      <p style="color: #888; font-size: 12px; margin-top: 32px;">
        Mentingo Platform
      </p>
    </div>`;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private replaceCidReferences(html: string): string {
    const logoUrl = `${CORS_ORIGIN}/app/assets/svgs/app-logo.svg`;
    const borderCircleUrl = `${CORS_ORIGIN}/app/assets/svgs/app-email-border-circle.svg`;

    return html.replace(/cid:logo/g, logoUrl).replace(/cid:border-circle/g, borderCircleUrl);
  }
}
