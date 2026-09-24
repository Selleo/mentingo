import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_EVENTS,
  EMAIL_TEMPLATE_STATUSES,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

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

  it.each(["name", "subject", "content"] as const)(
    "rejects incomplete published %s edits atomically",
    async (field) => {
      const template = await t.create();
      await t.http("post", `/${template.id}/publish`).expect(201);
      const before = await t.get(template.id!);
      const value = field === "content" ? { type: "doc", version: 1, content: [] } : "";
      const response = await t
        .http("patch", `/${template.id}`)
        .send({ [field]: { en: value } })
        .expect(400);
      expect(response.body.message).toBe("emailTemplates.errors.incompleteBaseLanguage");
      expect(await t.get(template.id!)).toEqual(before);
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

  it("requires actionable authentication links for publish and base-language changes", async () => {
    const body = draftBody(
      EMAIL_TEMPLATE_DEFINITIONS.find(
        ({ event }) => event === EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY,
      )!,
    );
    body.content = { en: textDocument("No authentication action") };
    const template = await t.create(body);
    for (const operation of ["publish", "base-language"] as const) {
      const req = t.http(
        operation === "publish" ? "post" : "patch",
        `/${template.id}/${operation}`,
      );
      if (operation === "base-language") req.send({ baseLanguage: SUPPORTED_LANGUAGES.EN });
      const response = await req.expect(400);
      expect(response.body.message).toBe("emailTemplates.errors.missingMandatoryVariables");
      expect(await t.get(template.id!)).toEqual(template);
    }
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

  it("serializes competing publications and isolates other tenants and events", async () => {
    const first = await t.create();
    const second = await t.create();
    const other = (
      await t.http("post", "", t.otherCookie, t.otherTenant.host).send(draftBody()).expect(201)
    ).body.data;
    await t.http("post", `/${other.id}/publish`, t.otherCookie, t.otherTenant.host).expect(201);
    const different = await t.create(
      draftBody(EMAIL_TEMPLATE_DEFINITIONS.find(({ event }) => event !== first.event)!),
    );
    await t.http("post", `/${different.id}/publish`).expect(201);
    const differentBefore = await t.get(different.id!);
    await Promise.all(
      [first, second].map(({ id }) => t.http("post", `/${id}/publish`).expect(201)),
    );
    const records = await Promise.all([t.get(first.id!), t.get(second.id!)]);
    expect(records.filter(({ status }) => status === "published")).toHaveLength(1);
    expect(records.filter(({ status }) => status === "archived")).toHaveLength(1);
    expect(records.find(({ status }) => status === "published")).toMatchObject({
      publishedAt: expect.any(String),
      archivedAt: null,
    });
    expect(records.find(({ status }) => status === "archived")?.archivedAt).toEqual(
      expect.any(String),
    );
    expect(await t.get(different.id!)).toEqual(differentBefore);
    expect(
      (await t.http("get", `/${other.id}`, t.otherCookie, t.otherTenant.host).expect(200)).body.data
        .status,
    ).toBe("published");
  });

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
