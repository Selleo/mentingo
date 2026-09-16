import { randomUUID } from "node:crypto";

import { EMAIL_TEMPLATE_DEFINITIONS } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { QueueService } from "src/queue";
import { emailTemplates } from "src/storage/schema";

import { emailTemplateSchema } from "../schemas/email-template.schema";

import {
  draftBody,
  previewBody,
  setupEmailTemplateTest,
  textDocument,
  welcome,
} from "./email-template-test.helpers";

import type { EmailTemplateTestContext } from "./email-template-test.helpers";

const idRoutes = [
  { method: "get", suffix: "" },
  { method: "patch", suffix: "", body: { name: { en: "Changed" } } },
  { method: "patch", suffix: "/base-language", body: { baseLanguage: SUPPORTED_LANGUAGES.PL } },
  { method: "post", suffix: "/duplicate" },
  { method: "post", suffix: "/publish" },
  { method: "post", suffix: "/archive" },
  { method: "post", suffix: "/restore" },
  { method: "delete", suffix: "" },
] as const;

describe("Email template HTTP contracts (e2e)", () => {
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

  describe.each([
    ...idRoutes.map((route) => ({ ...route, path: `/:id${route.suffix}` })),
    { method: "get", path: "" },
    { method: "post", path: "", body: draftBody() },
    { method: "get", path: `/defaults/${welcome.event}` },
    { method: "post", path: `/defaults/${welcome.event}/copy` },
    { method: "post", path: "/preview", body: previewBody() },
    { method: "post", path: "/test-send", body: previewBody() },
    { method: "post", path: "/images" },
    { method: "get", path: "/images/:id" },
  ] as const)("$method $path authorization", (route) => {
    it.each(["anonymous", "student"])("rejects %s without side effects", async (actor) => {
      const template = await t.create();
      const before = await t.runAsTenant(t.defaultTenantId, () =>
        t.db.select().from(emailTemplates),
      );
      const enqueue = jest.spyOn(t.app.get(QueueService), "enqueue");
      const req = t.http(
        route.method,
        route.path.replace(":id", template.id!),
        actor === "anonymous" ? "" : t.studentCookie,
      );
      if ("body" in route) req.send(route.body);
      if (route.path === "/images")
        req.attach("file", t.png, { filename: "image.png", contentType: "image/png" });
      const response = await req.expect(actor === "anonymous" ? 401 : 403);
      if (actor === "student") expect(response.body.message).toBe("auth.error.missingPermission");
      expect(
        await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(emailTemplates)),
      ).toEqual(before);
      expect(enqueue).not.toHaveBeenCalled();
      expect(t.upload).not.toHaveBeenCalled();
      expect(t.adapter.getAllEmails()).toEqual([]);
    });
  });

  describe.each(idRoutes)("$method /:id$suffix isolation", (route) => {
    it.each(["malformed", "missing", "deleted", "foreign"])("rejects %s IDs", async (kind) => {
      const template = await t.create();
      let id = template.id!;
      if (kind === "malformed") id = "not-a-uuid";
      if (kind === "missing") id = randomUUID();
      if (kind === "deleted") await t.http("delete", `/${id}`).expect(200);
      const cookie = kind === "foreign" ? t.otherCookie : t.adminCookie;
      const host = kind === "foreign" ? t.otherTenant.host : undefined;
      const req = t.http(route.method, `/${id}${route.suffix}`, cookie, host);
      if ("body" in route) req.send(route.body);
      const response = await req.expect(kind === "malformed" ? 400 : 404);
      if (kind !== "malformed")
        expect(response.body.message).toBe("emailTemplates.errors.notFound");
      if (kind !== "deleted") expect(await t.get(template.id!)).toEqual(template);
      expect(t.adapter.getAllEmails()).toEqual([]);
    });
  });

  it.each(EMAIL_TEMPLATE_DEFINITIONS)(
    "reads and independently copies the $event default",
    async (definition) => {
      const path = `/defaults/${definition.event}`;
      const original = (await t.http("get", path).expect(200)).body.data;
      expect(Value.Check(emailTemplateSchema, original)).toBe(true);
      expect(original).toMatchObject({
        id: null,
        source: "default",
        editable: false,
        status: null,
        subject: definition.subjects,
        content: definition.defaultDocuments,
      });
      const first = (await t.http("post", `${path}/copy`).expect(201)).body.data;
      const second = (await t.http("post", `${path}/copy`).expect(201)).body.data;
      expect(first.id).not.toBe(second.id);
      expect(first).toMatchObject({
        source: "override",
        editable: true,
        status: "draft",
        subject: original.subject,
        content: original.content,
      });
      expect(Value.Check(emailTemplateSchema, await t.get(first.id))).toBe(true);
      await t
        .http("patch", `/${first.id}`)
        .send({ name: { en: "Independent copy" } })
        .expect(200);
      expect(await t.get(second.id)).toEqual(second);
      expect((await t.http("get", path).expect(200)).body.data).toEqual(original);
    },
  );

  it.each(["get", "post"] as const)("rejects unsupported default events via %s", async (method) => {
    await t.http(method, `/defaults/not-an-event${method === "post" ? "/copy" : ""}`).expect(400);
    expect(
      await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(emailTemplates)),
    ).toEqual([]);
  });

  it("paginates overrides before defaults with stable ordering and accurate totals", async () => {
    const first = await t.create();
    const second = await t.create();
    const deleted = await t.create();
    await t.http("delete", `/${deleted.id}`).expect(200);
    await t.http("post", "", t.otherCookie, t.otherTenant.host).send(draftBody()).expect(201);
    await t
      .http("patch", `/${first.id}`)
      .send({ name: { en: "Latest" } })
      .expect(200);
    const firstPage = (await t.http("get").query({ page: 1, perPage: 3 }).expect(200)).body;
    expect(firstPage.data.map((item: { id: string | null }) => item.id)).toEqual([
      first.id,
      second.id,
      null,
    ]);
    expect(firstPage.pagination).toMatchObject({
      page: 1,
      perPage: 3,
      totalItems: EMAIL_TEMPLATE_DEFINITIONS.length + 2,
    });
    expect(firstPage.data[2].event).toBe(EMAIL_TEMPLATE_DEFINITIONS[0].event);
    const secondPage = (await t.http("get").query({ page: 2, perPage: 3 }).expect(200)).body;
    expect(secondPage.data.map((item: { event: string }) => item.event)).toEqual(
      EMAIL_TEMPLATE_DEFINITIONS.slice(1, 4).map(({ event }) => event),
    );
    const defaults = (await t.http("get").expect(200)).body;
    expect(defaults.pagination).toMatchObject({ page: 1, perPage: DEFAULT_PAGE_SIZE });
    expect((await t.http("get").query({ page: 100, perPage: 100 }).expect(200)).body.data).toEqual(
      [],
    );
    expect((await t.http("get").query({ perPage: 1 }).expect(200)).body.data).toHaveLength(1);
  });

  it.each([
    { page: 0 },
    { page: -1 },
    { page: "bad" },
    { perPage: 0 },
    { perPage: 101 },
    { perPage: "bad" },
  ])("rejects invalid pagination %j", async (query) => {
    await t.http("get").query(query).expect(400);
  });

  it("creates incomplete drafts with default or explicit base languages", async () => {
    const body = { event: welcome.event, name: {}, subject: {}, content: {} };
    const implicit = await t.create(body);
    expect(implicit).toMatchObject({
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      status: "draft",
      availableLocales: [],
      completeLocales: [],
    });
    const explicit = await t.create({
      ...body,
      baseLanguage: SUPPORTED_LANGUAGES.PL,
      subject: { pl: "Temat" },
      content: { pl: textDocument() },
    });
    expect(explicit).toMatchObject({
      baseLanguage: SUPPORTED_LANGUAGES.PL,
      availableLocales: [SUPPORTED_LANGUAGES.PL],
      completeLocales: [SUPPORTED_LANGUAGES.PL],
    });
    expect(await t.get(explicit.id!)).toEqual(explicit);
  });

  it.each([
    {},
    { ...draftBody(), event: "unknown" },
    { ...draftBody(), tenantId: randomUUID() },
    { ...draftBody(), name: { xx: "Unsupported" } },
    { ...draftBody(), baseLanguage: "xx" },
  ])("rejects invalid create payload %# without persisting", async (body) => {
    await t.http("post").send(body).expect(400);
    expect(
      await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(emailTemplates)),
    ).toEqual([]);
  });

  it.each([{}, { status: "published" }, { event: welcome.event }, { name: { xx: "No" } }])(
    "rejects invalid update payload %# without changing the template",
    async (body) => {
      const template = await t.create();
      await t.http("patch", `/${template.id}`).send(body).expect(400);
      expect(await t.get(template.id!)).toEqual(template);
    },
  );
});
