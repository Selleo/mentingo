import { ConflictException } from "@nestjs/common";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT,
  EMAIL_TEMPLATE_STATUSES,
} from "@repo/email-templates";

import { EmailTemplateValidationService } from "./email-template-validation.service";
import { EmailTemplateService } from "./email-template.service";

import type { EmailTemplateAssetService } from "./email-template-asset.service";
import type { EmailTemplateRecord } from "../email-template.types";
import type { EmailTemplateRepository } from "../repositories/email-template.repository";
import type { EmailService } from "src/common/emails/emails.service";

describe("EmailTemplateService mutation validation", () => {
  const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.password_recovery;
  let template: EmailTemplateRecord;
  let lockHeld: boolean;
  const updateEmailTemplate = jest.fn();
  const publishEmailTemplate = jest.fn();
  const createEmailTemplate = jest.fn();
  const deleteEmailTemplate = jest.fn();
  const findEmailTemplateOverridePageWithTotal = jest.fn();
  let service: EmailTemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    lockHeld = false;
    template = {
      id: "00000000-0000-4000-8000-000000000001",
      tenantId: "00000000-0000-4000-8000-000000000002",
      event: definition.event,
      name: definition.name,
      subject: definition.subjects,
      content: definition.defaultDocuments,
      baseLanguage: "en",
      availableLocales: ["en"],
      status: EMAIL_TEMPLATE_STATUSES.PUBLISHED,
      createdAt: "2026-09-11T00:00:00Z",
      updatedAt: "2026-09-11T00:00:00Z",
      publishedAt: "2026-09-11T00:00:00Z",
      archivedAt: null,
      deletedAt: null,
    };
    const repository = {
      withLockedEmailTemplate: jest.fn(async (_id, callback) => {
        lockHeld = true;
        try {
          return await callback(template);
        } finally {
          lockHeld = false;
        }
      }),
      updateEmailTemplate,
      updateEmailTemplateTranslations: updateEmailTemplate,
      publishEmailTemplate,
      createEmailTemplate,
      deleteEmailTemplate,
      findEmailTemplateOverridePageWithTotal,
    };
    updateEmailTemplate.mockImplementation(async (_id, values) => {
      expect(lockHeld).toBe(true);
      template = {
        ...template,
        ...values,
        name: { ...template.name, ...values.name },
        subject: { ...template.subject, ...values.subject },
        content: { ...template.content, ...values.content },
      };
      return template;
    });
    publishEmailTemplate.mockImplementation(async () => {
      expect(lockHeld).toBe(true);
      return template;
    });
    service = new EmailTemplateService(
      repository as unknown as EmailTemplateRepository,
      new EmailTemplateValidationService(),
      {} as EmailService,
      {
        validateEmailTemplateAssets: jest.fn().mockResolvedValue(undefined),
      } as unknown as EmailTemplateAssetService,
    );
  });

  it.each(Object.values(EMAIL_TEMPLATE_STATUSES))(
    "deletes a %s template under the publication lock",
    async (status) => {
      template.status = status;
      deleteEmailTemplate.mockImplementation(async () => {
        expect(lockHeld).toBe(true);
      });
      await service.deleteEmailTemplate(template.id);
      expect(deleteEmailTemplate).toHaveBeenCalledWith(template.id);
    },
  );

  it("rejects an incomplete update using the status read under the lock", async () => {
    await expect(service.updateEmailTemplate(template.id, { subject: { en: "" } })).rejects.toThrow(
      "emailTemplates.errors.incompleteBaseLanguage",
    );
    expect(updateEmailTemplate).not.toHaveBeenCalled();
  });

  it("preserves other locales when administrators save independent translations", async () => {
    await service.updateEmailTemplate(template.id, { subject: { pl: "Nowy temat" } });
    const result = await service.updateEmailTemplate(template.id, {
      subject: { en: "New subject" },
    });
    expect(result.subject).toMatchObject({ pl: "Nowy temat", en: "New subject" });
    expect(result.content).toEqual(definition.defaultDocuments);
    expect(updateEmailTemplate.mock.calls[1][1].subject).toEqual({ en: "New subject" });
  });

  it("validates a partial translation against the latest stored body", async () => {
    template.content = { ...template.content, pl: { type: "doc", version: 1, content: [] } };
    const result = await service.updateEmailTemplate(template.id, {
      subject: { en: "New subject" },
    });
    expect(result.subject.pl).toEqual(definition.subjects.pl);
    expect(result.content.pl?.content).toEqual([]);
  });

  it.each([
    { page: 1, overrideCount: 8, returnedOverrides: 5, defaultStart: 0, defaultEnd: 0 },
    { page: 2, overrideCount: 8, returnedOverrides: 3, defaultStart: 0, defaultEnd: 2 },
    { page: 3, overrideCount: 8, returnedOverrides: 0, defaultStart: 2, defaultEnd: 7 },
    { page: 2, overrideCount: 5, returnedOverrides: 0, defaultStart: 0, defaultEnd: 5 },
    { page: 1, overrideCount: 0, returnedOverrides: 0, defaultStart: 0, defaultEnd: 5 },
    { page: 5, overrideCount: 0, returnedOverrides: 0, defaultStart: 20, defaultEnd: 25 },
    { page: 100, overrideCount: 8, returnedOverrides: 0, defaultStart: 487, defaultEnd: 492 },
  ])(
    "paginates page $page with $overrideCount overrides",
    async ({ page, overrideCount, returnedOverrides, defaultStart, defaultEnd }) => {
      const perPage = 5;
      findEmailTemplateOverridePageWithTotal.mockResolvedValue({
        templates: Array.from({ length: returnedOverrides }, () => template),
        totalItems: overrideCount,
      });

      const result = await service.getEmailTemplates(page, perPage);
      const expectedDefaults = EMAIL_TEMPLATE_DEFINITIONS.slice(defaultStart, defaultEnd);

      expect(findEmailTemplateOverridePageWithTotal).toHaveBeenCalledWith(
        (page - 1) * perPage,
        perPage,
      );
      expect(result.data.map(({ source }) => source)).toEqual([
        ...Array.from({ length: returnedOverrides }, () => "override"),
        ...expectedDefaults.map(() => "default"),
      ]);
      expect(result.data.slice(returnedOverrides).map(({ event }) => event)).toEqual(
        expectedDefaults.map(({ event }) => event),
      );
      expect(result.pagination).toEqual({
        page,
        perPage,
        totalItems: overrideCount + EMAIL_TEMPLATE_DEFINITIONS.length,
      });
    },
  );

  it("validates the locked content before publication", async () => {
    template = { ...template, subject: { en: "" }, status: EMAIL_TEMPLATE_STATUSES.DRAFT };
    await expect(service.publishEmailTemplate(template.id)).rejects.toThrow(
      "emailTemplates.errors.incompleteBaseLanguage",
    );
    expect(publishEmailTemplate).not.toHaveBeenCalled();
  });

  it("holds the mutation lock through the validated write", async () => {
    await service.updateEmailTemplate(template.id, { name: { en: "Reset password" } });
    expect(updateEmailTemplate).toHaveBeenCalledTimes(1);
    expect(lockHeld).toBe(false);
  });

  it("holds the mutation lock through publication", async () => {
    await service.publishEmailTemplate(template.id);
    expect(publishEmailTemplate).toHaveBeenCalledTimes(1);
    expect(lockHeld).toBe(false);
  });

  it("maps a publication uniqueness violation to a conflict and releases the lock", async () => {
    publishEmailTemplate.mockRejectedValueOnce({ code: "23505" });
    await expect(service.publishEmailTemplate(template.id)).rejects.toEqual(
      new ConflictException("emailTemplates.errors.publicationConflict"),
    );
    expect(lockHeld).toBe(false);
  });

  it("preserves unexpected publication errors instead of reporting a conflict", async () => {
    const failure = new Error("Database unavailable");
    publishEmailTemplate.mockRejectedValueOnce(failure);
    await expect(service.publishEmailTemplate(template.id)).rejects.toBe(failure);
    expect(lockHeld).toBe(false);
  });

  it("duplicates a published template as a new draft without publication metadata", async () => {
    createEmailTemplate.mockImplementation(async (values) => {
      expect(lockHeld).toBe(true);
      return {
        ...template,
        ...values,
        id: "00000000-0000-4000-8000-000000000003",
        publishedAt: null,
        archivedAt: null,
        deletedAt: null,
      };
    });
    const result = await service.duplicateEmailTemplate(template.id);
    expect(result.status).toBe(EMAIL_TEMPLATE_STATUSES.DRAFT);
    expect(result.id).not.toBe(template.id);
    expect(result.name).toEqual(template.name);
    expect(createEmailTemplate.mock.calls[0][0]).not.toHaveProperty("publishedAt");
    expect(createEmailTemplate.mock.calls[0][0]).not.toHaveProperty("id");
    expect(publishEmailTemplate).not.toHaveBeenCalled();
  });
});
