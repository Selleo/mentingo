import { getBuiltInTemplatePublication, getBuiltInTemplateEvent } from "@repo/email-templates";
import { BUILT_IN_EMAIL_TEMPLATE_KEYS, SUPPORTED_LANGUAGES } from "@repo/shared";

import { findAutomationEventDefinition } from "src/automations/catalog/automation-event-catalog";
import {
  getAccountActionPlaceholderNames,
  resolveAutomationMappings,
} from "src/automations/mappers/automation-mapping";

import { EmailTemplateRenderingService } from "./email-template-rendering.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type { EmailTemplateAssetService } from "./email-template-asset.service";
import type { EmailTemplateRepository } from "../repositories/email-template.repository";
import type { AutomationPlaceholderMappings } from "@repo/shared";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe("EmailTemplateRenderingService", () => {
  const findEmailTemplateById = jest.fn();
  const resolveEmailTemplateAssets = jest.fn(async (document) => ({ document, attachments: [] }));
  const service = new EmailTemplateRenderingService(
    { findEmailTemplateById } as unknown as EmailTemplateRepository,
    new EmailTemplateValidationService(),
    { resolveEmailTemplateAssets } as unknown as EmailTemplateAssetService,
    { runWithTenant: async (_tenant, callback) => callback() } as TenantDbRunnerService,
  );
  const branding = { companyName: "Tenant", primaryColor: "#123456" };
  beforeEach(() => jest.clearAllMocks());

  describe.each(Object.values(BUILT_IN_EMAIL_TEMPLATE_KEYS))("built-in %s", (key) => {
    it.each(Object.values(SUPPORTED_LANGUAGES))(
      "renders the complete occurrence contract in %s",
      async (language) => {
        const publication = getBuiltInTemplatePublication(key);
        const event = findAutomationEventDefinition(getBuiltInTemplateEvent(key))!;
        const mappings: AutomationPlaceholderMappings = Object.fromEntries(
          publication.placeholders.map((placeholder) => [
            placeholder.name,
            { type: "event_field", field: placeholder.name },
          ]),
        );
        const fields = Object.fromEntries(
          event.fields.map((field) => [field.key, field.sampleValue]),
        );
        const rendered = await service.renderEmailTemplatePublication(
          "tenant",
          publication,
          language,
          resolveAutomationMappings(mappings, fields, language, publication.baseLanguage),
          branding,
          { sensitivePlaceholderKeys: getAccountActionPlaceholderNames(event, mappings) },
        );
        expect(rendered.language).toBe(language);
        expect(rendered.subject.trim()).not.toBe("");
        expect(rendered.text.trim()).not.toBe("");
        expect(rendered.html).not.toMatch(/{{\s*[a-zA-Z0-9_]+\s*}}/);
      },
    );
  });

  it("uses the current publication rather than unsaved draft content", async () => {
    const publication = getBuiltInTemplatePublication("password_recovery");
    findEmailTemplateById.mockResolvedValue({
      status: "published",
      publication,
      subject: { en: "Unsaved" },
    });
    expect(await service.getPublishedEmailTemplate({ type: "custom", id: "template" })).toEqual(
      publication,
    );
    expect(
      await service.getPublishedEmailTemplate({ type: "builtin", key: "password_recovery" }),
    ).toEqual(publication);
  });
  it("rejects archived and draft custom resources", async () => {
    for (const status of ["draft", "archived"]) {
      findEmailTemplateById.mockResolvedValue({
        status,
        publication: getBuiltInTemplatePublication("welcome"),
      });
      await expect(
        service.getPublishedEmailTemplate({ type: "custom", id: "template" }),
      ).rejects.toThrow("emailTemplates.errors.notPublished");
    }
  });
  it("falls back the entire message and escapes values", async () => {
    const publication = getBuiltInTemplatePublication("password_recovery");
    publication.subject = { en: "Reset for {{ name }}", pl: "Polski temat" };
    publication.content = { en: publication.content.en };
    const rendered = await service.renderEmailTemplatePublication(
      "tenant",
      publication,
      SUPPORTED_LANGUAGES.PL,
      { name: "Alex <script>", reset_link: "https://tenant.example/reset" },
      branding,
      { sensitivePlaceholderKeys: ["reset_link"] },
    );
    expect(rendered.language).toBe("en");
    expect(rendered.subject).toBe("Reset for Alex <script>");
    expect(rendered.html).toContain("Alex &lt;script&gt;");
    expect(rendered.html).not.toContain("<script>");
  });
  it("preserves source sensitivity after the mapped placeholder is renamed", async () => {
    const publication = getBuiltInTemplatePublication("password_recovery");
    publication.placeholders = publication.placeholders.map((item) =>
      item.name === "reset_link" ? { ...item, name: "action" } : item,
    );
    publication.content = JSON.parse(
      JSON.stringify(publication.content).replaceAll("reset_link", "action"),
    );
    publication.subject = { en: "{{ action }}" };
    await expect(
      service.renderEmailTemplatePublication(
        "tenant",
        publication,
        "en",
        { name: "Alex", action: "https://tenant.example/secret" },
        branding,
        { sensitivePlaceholderKeys: ["action"] },
      ),
    ).rejects.toThrow("emailTemplates.errors.restrictedAuthVariables");
    expect(resolveEmailTemplateAssets).not.toHaveBeenCalled();
  });
  it("renders the selected deadline variant in the fallback language", async () => {
    const publication = getBuiltInTemplatePublication("deadline_today");
    publication.subject = { en: publication.subject.en };
    publication.content = { en: publication.content.en };
    const values = {
      course_name: "Safety",
      course_link: "https://tenant.example/course",
      due_date: "2026-10-01",
      days_before_due_date: 0,
    };
    const rendered = await service.renderEmailTemplatePublication(
      "tenant",
      publication,
      "pl",
      values,
      branding,
    );
    expect(rendered.text).toContain('The deadline to complete course "Safety" is today.');
  });
  it("validates mapped values before resolving assets", async () => {
    const publication = getBuiltInTemplatePublication("password_recovery");
    await expect(
      service.renderEmailTemplatePublication(
        "tenant",
        publication,
        "en",
        { name: "Alex", reset_link: "javascript:alert(1)" },
        branding,
      ),
    ).rejects.toThrow("emailTemplates.errors.httpsRequired");
    expect(resolveEmailTemplateAssets).not.toHaveBeenCalled();
  });
});
