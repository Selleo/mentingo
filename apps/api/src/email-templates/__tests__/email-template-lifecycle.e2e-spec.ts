import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_EVENTS,
  EMAIL_TEMPLATE_STATUSES,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { RemoveEmailTemplateLanguageEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

import { EmailTemplateRenderingService } from "../services/email-template-rendering.service";

import { draftBody, setupEmailTemplateTest, textDocument } from "./email-template-test.helpers";

import type { EmailTemplateTestContext } from "./email-template-test.helpers";

describe("Email template HTTP lifecycle and translations (e2e)", () => {
  let t: EmailTemplateTestContext;
  beforeAll(async () => {
    t = await setupEmailTemplateTest();
  });
  beforeEach(async () => {
    await t.reset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await t?.app.close();
    jest.restoreAllMocks();
  });

  it("merges independent concurrent locale edits and permits clearing draft fields", async () => {
    const template = await t.create();
    await Promise.all(
      [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL].map((language) =>
        t
          .http("patch", `/${template.id}`)
          .send({
            name: { [language]: `Name ${language}` },
            subject: { [language]: `Subject ${language}` },
            content: { [language]: textDocument(`Body ${language}`) },
          })
          .expect(200),
      ),
    );
    const stored = await t.get(template.id!);
    expect(stored.name).toEqual({ ...template.name, en: "Name en", pl: "Name pl" });
    expect(stored.subject).toEqual({ ...template.subject, en: "Subject en", pl: "Subject pl" });
    expect(stored.content).toEqual({
      ...template.content,
      en: textDocument("Body en"),
      pl: textDocument("Body pl"),
    });
    await t
      .http("patch", `/${template.id}`)
      .send({ subject: { en: "" } })
      .expect(200);
    const cleared = await t.get(template.id!);
    expect(cleared.subject).toEqual({ ...stored.subject, en: "" });
    expect(cleared.content).toEqual(stored.content);
    expect(cleared.completeLocales).not.toContain(SUPPORTED_LANGUAGES.EN);
    expect(cleared.availableLocales).toContain(SUPPORTED_LANGUAGES.EN);
  });

  it("removes a non-base translation and protects the base language", async () => {
    const template = await t.create();
    const publishSpy = jest.spyOn(t.app.get(OutboxPublisher), "publish");

    await t.http("delete", `/${template.id}/languages/pl`, t.studentCookie).expect(403);
    await t.http("delete", `/${template.id}/languages/en`).expect(400);
    const response = await t.http("delete", `/${template.id}/languages/pl`).expect(200);
    expect(response.body.data.name).not.toHaveProperty("pl");
    expect(response.body.data.subject).not.toHaveProperty("pl");
    expect(response.body.data.content).not.toHaveProperty("pl");
    expect(response.body.data.availableLocales).not.toContain(SUPPORTED_LANGUAGES.PL);
    expect((await t.get(template.id!)).content).not.toHaveProperty("pl");
    expect(
      publishSpy.mock.calls.some(
        ([event]) =>
          event instanceof RemoveEmailTemplateLanguageEvent &&
          event.data.context?.language === "pl",
      ),
    ).toBe(true);

    await t.http("post", `/${template.id}/archive`).expect(201);
    await t.http("delete", `/${template.id}/languages/de`).expect(400);
  });

  it("rolls back a template edit if its outbox event cannot be stored", async () => {
    const template = await t.create();
    const publishSpy = jest.spyOn(t.app.get(OutboxPublisher), "publish");
    publishSpy.mockRejectedValueOnce(new Error("Outbox unavailable"));

    await t
      .http("patch", `/${template.id}`)
      .send({ name: { en: "Changed name" } })
      .expect(500);

    expect(await t.get(template.id!)).toEqual(template);
  });

  it.each(["name", "subject", "content"] as const)(
    "saves incomplete %s drafts without changing publication",
    async (field) => {
      const template = await t.create();
      await t.http("post", `/${template.id}/publish`).expect(201);
      const publication = await t.runAsTenant(t.defaultTenantId, () =>
        t.app
          .get(EmailTemplateRenderingService)
          .getPublishedEmailTemplate({ type: "custom", id: template.id! }),
      );
      const value = field === "content" ? { type: "doc", version: 1, content: [] } : "";
      const response = await t
        .http("patch", `/${template.id}`)
        .send({ [field]: { en: value } })
        .expect(200);
      expect(response.body.data.hasUnpublishedChanges).toBe(true);
      expect(
        await t.runAsTenant(t.defaultTenantId, () =>
          t.app
            .get(EmailTemplateRenderingService)
            .getPublishedEmailTemplate({ type: "custom", id: template.id! }),
        ),
      ).toEqual(publication);
      await t.http("post", `/${template.id}/publish`).expect(400);
    },
  );

  it("allows complete edits to a published translation without changing status", async () => {
    const template = await t.create();
    await t.http("post", `/${template.id}/publish`).expect(201);
    const response = await t
      .http("patch", `/${template.id}`)
      .send({ subject: { en: "Updated live subject" } })
      .expect(200);
    expect(response.body.data).toMatchObject({
      status: "published",
      subject: { ...template.subject, en: "Updated live subject" },
    });
  });

  it.each(Object.values(EMAIL_TEMPLATE_STATUSES))(
    "duplicates a %s template into an independent draft",
    async (status) => {
      const template = await t.create();
      if (status === "published") await t.http("post", `/${template.id}/publish`).expect(201);
      if (status === "archived") await t.http("post", `/${template.id}/archive`).expect(201);
      const original = await t.get(template.id!);
      const duplicate = (await t.http("post", `/${template.id}/duplicate`).expect(201)).body.data;
      expect(duplicate.id).not.toBe(template.id);
      expect(duplicate).toMatchObject({
        name: original.name,
        subject: original.subject,
        content: original.content,
        baseLanguage: original.baseLanguage,
        availableLocales: original.availableLocales,
        status: "draft",
        publishedAt: null,
        archivedAt: null,
      });
      await t
        .http("patch", `/${duplicate.id}`)
        .send({ name: { en: "Duplicate" } })
        .expect(200);
      expect(await t.get(template.id!)).toEqual(original);
    },
  );

  it("changes the base language only when the target translation is complete", async () => {
    const template = await t.create();
    const updated = (
      await t
        .http("patch", `/${template.id}/base-language`)
        .send({ baseLanguage: SUPPORTED_LANGUAGES.PL })
        .expect(200)
    ).body.data;
    expect(updated).toMatchObject({
      baseLanguage: SUPPORTED_LANGUAGES.PL,
      name: template.name,
      subject: template.subject,
      content: template.content,
    });
  });

  it.each(["name", "subject", "content"] as const)(
    "rejects an incomplete base-language %s",
    async (field) => {
      const body = draftBody();
      delete body[field][SUPPORTED_LANGUAGES.PL];
      const template = await t.create(body);
      const response = await t
        .http("patch", `/${template.id}/base-language`)
        .send({ baseLanguage: SUPPORTED_LANGUAGES.PL })
        .expect(400);
      expect(response.body.message).toBe("emailTemplates.errors.incompleteBaseLanguage");
      expect(await t.get(template.id!)).toEqual(template);
    },
  );

  it.each([
    {},
    { baseLanguage: "xx" },
    { baseLanguage: SUPPORTED_LANGUAGES.PL, status: "published" },
  ])("rejects malformed base-language payload %#", async (body) => {
    const template = await t.create();
    await t.http("patch", `/${template.id}/base-language`).send(body).expect(400);
    expect(await t.get(template.id!)).toEqual(template);
  });

  it("publishes generic content without deriving restrictions from placeholder names", async () => {
    const body = draftBody(
      EMAIL_TEMPLATE_DEFINITIONS.find(
        ({ event }) => event === EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY,
      )!,
    );
    body.content = { en: textDocument("Generic content") };
    const template = await t.create(body);
    await t.http("post", `/${template.id}/publish`).expect(201);
    await t.http("patch", `/${template.id}/base-language`).send({ baseLanguage: "en" }).expect(200);
  });

  it("rejects incomplete publication without archiving the active override", async () => {
    const active = await t.create();
    await t.http("post", `/${active.id}/publish`).expect(201);
    const before = await t.get(active.id!);
    const invalid = await t.create({ ...draftBody(), name: {} });
    await t.http("post", `/${invalid.id}/publish`).expect(400);
    expect(await t.get(active.id!)).toEqual(before);
    expect(await t.get(invalid.id!)).toEqual(invalid);
  });

  it("publishes multiple resources independently and isolates other tenants", async () => {
    const first = await t.create();
    const second = await t.create();
    const other = (
      await t.http("post", "", t.otherCookie, t.otherTenant.host).send(draftBody()).expect(201)
    ).body.data;
    await t.http("post", `/${other.id}/publish`, t.otherCookie, t.otherTenant.host).expect(201);
    const different = await t.create(
      draftBody(
        EMAIL_TEMPLATE_DEFINITIONS.find(
          ({ event }) => event === EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY,
        )!,
      ),
    );
    await t.http("post", `/${different.id}/publish`).expect(201);
    const differentBefore = await t.get(different.id!);
    await Promise.all(
      [first, second].map(({ id }) => t.http("post", `/${id}/publish`).expect(201)),
    );
    const records = await Promise.all([t.get(first.id!), t.get(second.id!)]);
    expect(records.filter(({ status }) => status === "published")).toHaveLength(2);
    expect(records.filter(({ status }) => status === "archived")).toHaveLength(0);
    expect(records.find(({ status }) => status === "published")).toMatchObject({
      publishedAt: expect.any(String),
      archivedAt: null,
    });
    expect(await t.get(different.id!)).toEqual(differentBefore);
    expect(
      (await t.http("get", `/${other.id}`, t.otherCookie, t.otherTenant.host).expect(200)).body.data
        .status,
    ).toBe("published");
  });

  it.each([EMAIL_TEMPLATE_STATUSES.DRAFT, EMAIL_TEMPLATE_STATUSES.PUBLISHED])(
    "rejects restoring a %s template directly",
    async (status) => {
      const template = await t.create();
      if (status === EMAIL_TEMPLATE_STATUSES.PUBLISHED) {
        await t.http("post", `/${template.id}/publish`).expect(201);
      }

      const response = await t.http("post", `/${template.id}/restore`).expect(400);

      expect(response.body.message).toBe("emailTemplates.errors.restoreRequiresArchived");
      expect((await t.get(template.id!)).status).toBe(status);
    },
  );

  it.each(Object.values(EMAIL_TEMPLATE_STATUSES))(
    "archives, restores and deletes from %s",
    async (status) => {
      const template = await t.create();
      if (status === "published") await t.http("post", `/${template.id}/publish`).expect(201);
      if (status === "archived") await t.http("post", `/${template.id}/archive`).expect(201);
      const archived = (await t.http("post", `/${template.id}/archive`).expect(201)).body.data;
      expect(archived).toMatchObject({ status: "archived", archivedAt: expect.any(String) });
      const restored = (await t.http("post", `/${template.id}/restore`).expect(201)).body.data;
      expect(restored).toMatchObject({ status: "draft", archivedAt: null });
      expect((await t.http("delete", `/${template.id}`).expect(200)).body).toEqual({ data: true });
      await t.http("get", `/${template.id}`).expect(404);
      await t.http("post", `/${template.id}/restore`).expect(404);
      const list = (await t.http("get").query({ perPage: 100 }).expect(200)).body;
      expect(list.data.some(({ id }: { id: string }) => id === template.id)).toBe(false);
    },
  );

  it.each(Object.values(EMAIL_TEMPLATE_STATUSES))("deletes directly from %s", async (status) => {
    const template = await t.create();
    if (status === "published") await t.http("post", `/${template.id}/publish`).expect(201);
    if (status === "archived") await t.http("post", `/${template.id}/archive`).expect(201);
    await t.http("delete", `/${template.id}`).expect(200);
    await t.http("delete", `/${template.id}`).expect(404);
  });
});
