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
});
