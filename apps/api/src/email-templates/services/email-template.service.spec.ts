import { ConflictException } from "@nestjs/common";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT,
  EMAIL_TEMPLATE_STATUSES,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import {
  AddEmailTemplateLanguageEvent,
  ArchiveEmailTemplateEvent,
  CreateEmailTemplateEvent,
  DeleteEmailTemplateEvent,
  PublishEmailTemplateEvent,
  RemoveEmailTemplateLanguageEvent,
  RestoreEmailTemplateEvent,
  UpdateEmailTemplateEvent,
} from "src/events";

import { EmailTemplateValidationService } from "./email-template-validation.service";
import { EmailTemplateService } from "./email-template.service";

import type { EmailTemplateAssetService } from "./email-template-asset.service";
import type { EmailTemplateRecord } from "../email-template.types";
import type { EmailTemplateRepository } from "../repositories/email-template.repository";
import type { SupportedLanguages } from "@repo/shared";
import type { EmailService } from "src/common/emails/emails.service";

describe("EmailTemplateService mutation validation", () => {
  const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT.password_recovery;
  let template: EmailTemplateRecord;
  let lockHeld: boolean;
  const updateEmailTemplate = jest.fn();
  const publishEmailTemplate = jest.fn();
  const createEmailTemplate = jest.fn();
  const deleteEmailTemplate = jest.fn();
  const removeEmailTemplateLanguage = jest.fn();
  const findEmailTemplateOverridePageWithTotal = jest.fn();
  const publishEvent = jest.fn();
  const createActor = () => ({
    userId: "00000000-0000-4000-8000-000000000004",
    email: "admin@example.com",
    roleSlugs: ["admin"],
    permissions: [],
    tenantId: template.tenantId,
  });
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
      availableLocales: Object.values(SUPPORTED_LANGUAGES),
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
      removeEmailTemplateLanguage,
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
      return { template, archivedTemplates: [] };
    });
    removeEmailTemplateLanguage.mockImplementation(
      async (_id: string, language: SupportedLanguages, availableLocales: SupportedLanguages[]) => {
        expect(lockHeld).toBe(true);
        const { [language]: _name, ...name } = template.name;
        const { [language]: _subject, ...subject } = template.subject;
        const { [language]: _content, ...content } = template.content;
        template = { ...template, name, subject, content, availableLocales };
        return template;
      },
    );
    service = new EmailTemplateService(
      repository as unknown as EmailTemplateRepository,
      new EmailTemplateValidationService(),
      {} as EmailService,
      {
        validateEmailTemplateAssets: jest.fn().mockResolvedValue(undefined),
      } as unknown as EmailTemplateAssetService,
      { publish: publishEvent } as never,
      { transaction: jest.fn(async (callback) => callback()) } as never,
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

  it("publishes a creation event with the new-template source", async () => {
    const actor = createActor();
    createEmailTemplate.mockResolvedValueOnce(template);

    await service.createEmailTemplate(
      {
        event: definition.event,
        name: definition.name,
        subject: definition.subjects,
        content: definition.defaultDocuments,
        baseLanguage: "en",
      },
      template.tenantId,
      actor,
    );

    expect(publishEvent.mock.calls[0][0]).toBeInstanceOf(CreateEmailTemplateEvent);
    expect(publishEvent.mock.calls[0][0].data.context).toEqual({ source: "new" });
  });

  it("publishes a deletion event while the template is locked", async () => {
    const actor = createActor();
    publishEvent.mockImplementation(() => {
      expect(lockHeld).toBe(true);
    });

    await service.deleteEmailTemplate(template.id, actor);

    expect(publishEvent.mock.calls[0][0]).toBeInstanceOf(DeleteEmailTemplateEvent);
    expect(publishEvent.mock.calls[0][0].data.resource.id).toBe(template.id);
  });

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

  it("publishes an update activity event inside the template transaction", async () => {
    const actor = createActor();

    publishEvent.mockImplementation(() => {
      expect(lockHeld).toBe(true);
    });
    await service.updateEmailTemplate(template.id, { name: { en: "New name" } }, actor);

    expect(publishEvent).toHaveBeenCalledTimes(1);
    const [event] = publishEvent.mock.calls[0];
    expect(event).toBeInstanceOf(UpdateEmailTemplateEvent);
    expect(event.data.actor).toBe(actor);
    expect(lockHeld).toBe(false);
  });

  it("records the first saved translation as a language addition", async () => {
    template.status = EMAIL_TEMPLATE_STATUSES.DRAFT;
    template.name = { en: "Reset password" };
    template.subject = { en: "Reset password" };
    template.content = { en: definition.defaultDocuments.en };
    template.availableLocales = ["en"];
    const actor = createActor();

    await service.updateEmailTemplate(template.id, { subject: { pl: "Nowy temat" } }, actor);

    expect(publishEvent.mock.calls[0][0]).toBeInstanceOf(UpdateEmailTemplateEvent);
    expect(publishEvent.mock.calls[1][0]).toBeInstanceOf(AddEmailTemplateLanguageEvent);
    expect(publishEvent.mock.calls[0][0].data.context).toEqual({
      name: template.name.en,
      languages: "pl",
      changedFields: "subject",
    });
    expect(publishEvent.mock.calls[1][0].data.context).toEqual({ language: "pl" });
    expect(lockHeld).toBe(false);
  });

  it("records the edited language's previous and updated content", async () => {
    const actor = createActor();

    await service.updateEmailTemplate(
      template.id,
      { content: { pl: definition.defaultDocuments.en } },
      actor,
    );

    expect(publishEvent.mock.calls[0][0]).toBeInstanceOf(UpdateEmailTemplateEvent);
    expect(publishEvent.mock.calls[0][0].data.context).toEqual({
      name: template.name.en,
      languages: "pl",
      changedFields: "content",
    });
    expect(publishEvent.mock.calls[0][0].data.previous.pl).toEqual({
      content: definition.defaultDocuments.pl,
    });
    expect(publishEvent.mock.calls[0][0].data.resource.pl).toEqual({
      content: definition.defaultDocuments.en,
    });
    expect(publishEvent.mock.calls[0][0].data.previous).not.toHaveProperty("name");
    expect(publishEvent.mock.calls[0][0].data.resource).not.toHaveProperty("name");
  });

  it("records a base-language name edit once under the language", async () => {
    const actor = createActor();
    const previousName = template.name.en;

    await service.updateEmailTemplate(
      template.id,
      { name: { en: "Updated template name" } },
      actor,
    );

    const event = publishEvent.mock.calls[0][0] as UpdateEmailTemplateEvent;
    expect(event.data.previous?.en).toEqual({ name: previousName });
    expect(event.data.resource.en).toEqual({ name: "Updated template name" });
    expect(event.data.previous).not.toHaveProperty("name");
    expect(event.data.resource).not.toHaveProperty("name");
    expect(event.data.context?.name).toBe("Updated template name");
  });

  it("records restoring an archived template after the write succeeds", async () => {
    template.status = EMAIL_TEMPLATE_STATUSES.ARCHIVED;
    const actor = createActor();

    await service.restoreEmailTemplate(template.id, actor);

    expect(updateEmailTemplate).toHaveBeenCalledWith(
      template.id,
      expect.objectContaining({ status: EMAIL_TEMPLATE_STATUSES.DRAFT }),
    );
    expect(publishEvent).toHaveBeenCalledTimes(1);
    expect(publishEvent.mock.calls[0][0]).toBeInstanceOf(RestoreEmailTemplateEvent);
    expect(publishEvent.mock.calls[0][0].data).toMatchObject({ actor, changedFields: ["status"] });
    expect(lockHeld).toBe(false);
  });

  it("records a base-language change as a template update", async () => {
    const actor = createActor();

    await service.updateBaseLanguage(template.id, { baseLanguage: "pl" }, actor);

    expect(publishEvent.mock.calls[0][0]).toBeInstanceOf(UpdateEmailTemplateEvent);
    expect(publishEvent.mock.calls[0][0].data).toMatchObject({
      changedFields: ["baseLanguage"],
    });
    expect(lockHeld).toBe(false);
  });

  it("removes a non-base language and records the language code", async () => {
    const actor = createActor();

    await service.removeEmailTemplateLanguage(template.id, "pl", actor);

    expect(removeEmailTemplateLanguage).toHaveBeenCalledWith(
      template.id,
      "pl",
      expect.not.arrayContaining(["pl"]),
    );
    expect(publishEvent.mock.calls[0][0]).toBeInstanceOf(RemoveEmailTemplateLanguageEvent);
    expect(publishEvent.mock.calls[0][0].data).toMatchObject({
      context: { language: "pl" },
    });
    expect(lockHeld).toBe(false);
  });

  it("rejects removal of the base language without changing the template", async () => {
    const actor = createActor();

    await expect(service.removeEmailTemplateLanguage(template.id, "en", actor)).rejects.toThrow(
      "emailTemplates.errors.cannotRemoveBaseLanguage",
    );
    expect(removeEmailTemplateLanguage).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("holds the mutation lock through publication", async () => {
    await service.publishEmailTemplate(template.id);
    expect(publishEmailTemplate).toHaveBeenCalledTimes(1);
    expect(lockHeld).toBe(false);
  });

  it("records the automatic archive when publishing replaces another template", async () => {
    template.status = EMAIL_TEMPLATE_STATUSES.DRAFT;
    const actor = createActor();
    const archived = {
      ...template,
      id: "00000000-0000-4000-8000-000000000005",
      status: EMAIL_TEMPLATE_STATUSES.ARCHIVED,
    };
    publishEmailTemplate.mockResolvedValueOnce({ template, archivedTemplates: [archived] });

    await service.publishEmailTemplate(template.id, actor);

    expect(publishEvent.mock.calls[0][0]).toBeInstanceOf(ArchiveEmailTemplateEvent);
    expect(publishEvent.mock.calls[1][0]).toBeInstanceOf(PublishEmailTemplateEvent);
    expect(publishEvent.mock.calls[0][0].data.resource.id).toBe(archived.id);
    expect(publishEvent.mock.calls[0][0].data.previous.status).toBe(
      EMAIL_TEMPLATE_STATUSES.PUBLISHED,
    );
    expect(lockHeld).toBe(false);
  });

  it("maps a publication uniqueness violation to a conflict and releases the lock", async () => {
    publishEmailTemplate.mockRejectedValueOnce({ code: "23505" });
    await expect(service.publishEmailTemplate(template.id)).rejects.toEqual(
      new ConflictException("emailTemplates.errors.publicationConflict"),
    );
    expect(lockHeld).toBe(false);
  });

  it("does not report an outbox write failure as a publication conflict", async () => {
    const failure = { code: "23505" };
    publishEvent.mockRejectedValueOnce(failure);

    await expect(service.publishEmailTemplate(template.id, createActor())).rejects.toBe(failure);
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
