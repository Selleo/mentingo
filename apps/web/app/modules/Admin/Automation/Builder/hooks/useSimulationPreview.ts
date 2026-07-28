import { ApiClient } from "~/api/api-client";

import { EMAIL_TEMPLATES } from "../emailTemplates.constants";

import type { SupportedLanguages } from "@repo/shared";

// ─── Custom template preview fetch ──────────────────────────────────────────

export async function fetchCustomTemplatePreview(
  templateId: string,
  language: string,
  placeholderValues: Record<string, string>,
  sampleValues: Record<string, string>,
  t: (key: string, options?: Record<string, string>) => string,
): Promise<{ subject: string; html: string }> {
  try {
    const { data } = await ApiClient.api.emailNotificationTemplatesControllerPreviewTemplate(
      templateId,
      {
        language: language as SupportedLanguages,
      },
    );

    let subject = data.data.subject;
    let html = data.data.html;

    for (const [placeholder, variableKey] of Object.entries(placeholderValues)) {
      const sampleValue = sampleValues[variableKey] ?? variableKey;
      const regex = new RegExp(`\\{\\{\\s*${escapeRegex(placeholder)}\\s*\\}\\}`, "g");
      subject = subject.replace(regex, sampleValue);
      html = html.replace(regex, sampleValue);
    }

    return { subject, html };
  } catch {
    const previewUnavailableMsg = t("automationBuilder.simulation.preview.loadFailed");
    return {
      subject: `[${t("automationBuilder.simulation.preview.unavailable")}] Template: ${templateId}`,
      html: `<div style="font-family: sans-serif; padding: 24px; color: #666;">
        <p>${previewUnavailableMsg}</p>
        <p style="font-size: 12px; color: #999;">Template ID: ${templateId}</p>
      </div>`,
    };
  }
}

// ─── System template preview fetch ──────────────────────────────────────────

export async function fetchSystemTemplatePreview(
  templateId: string,
  language: string,
  _placeholderValues: Record<string, string>,
  t: (key: string, options?: Record<string, string>) => string,
): Promise<{ subject: string; html: string }> {
  try {
    const response = await ApiClient.instance.get<{ data: { subject: string; html: string } }>(
      `/api/automations/system-template-preview/${encodeURIComponent(templateId)}`,
      { params: { language } },
    );

    const { subject, html } = response.data.data;

    if (!html) {
      return buildFallbackPreview(templateId, t);
    }

    return { subject, html };
  } catch {
    return buildFallbackPreview(templateId, t);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFallbackPreview(
  templateId: string,
  t: (key: string, options?: Record<string, string>) => string,
): { subject: string; html: string } {
  const templateDef = EMAIL_TEMPLATES.find((tmpl) => tmpl.id === templateId);
  const templateLabel = templateDef?.id ?? "default_email";

  const previewLabel = t("automationBuilder.simulation.preview.label");
  const systemTemplateNote = t("automationBuilder.simulation.preview.systemTemplateNote", {
    templateLabel,
  });
  const emailDescription = t("automationBuilder.simulation.preview.emailDescription");
  const platformName = t("automationBuilder.simulation.preview.platformName");

  return {
    subject: `${previewLabel}: ${templateLabel}`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 12px; color: #92400e;">
          ${systemTemplateNote}
        </p>
      </div>
      <p style="color: #4a4a4a; line-height: 1.6;">
        ${emailDescription}
      </p>
      <p style="color: #888; font-size: 12px; margin-top: 32px;">
        ${platformName}
      </p>
    </div>`,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
