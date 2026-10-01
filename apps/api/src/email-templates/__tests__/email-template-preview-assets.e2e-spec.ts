import { randomUUID } from "node:crypto";

import { EMAIL_TEMPLATE_DEFINITIONS } from "@repo/email-templates";
import { RESOURCE_VISIBILITY, SUPPORTED_LANGUAGES } from "@repo/shared";
import { eq } from "drizzle-orm";
import sharp from "sharp";

import { QueueService } from "src/queue";
import { emailTemplates, resources } from "src/storage/schema";

import { EMAIL_TEMPLATE_IMAGE_MAX_BYTES } from "../email-template.constants";

import {
  draftBody,
  languages,
  previewBody,
  setupEmailTemplateTest,
  textDocument,
} from "./email-template-test.helpers";

import type { EmailTemplateTestContext } from "./email-template-test.helpers";
import type { EmailTemplateDocument } from "@repo/email-templates";

const invalidDocuments: Array<{ name: string; document: unknown; error?: string }> = [
  { name: "wrong version", document: { ...textDocument(), version: 2 } },
  { name: "arbitrary HTML", document: { ...textDocument(), html: "<script>alert(1)</script>" } },
  {
    name: "unknown block",
    document: { ...textDocument(), content: [{ type: "html", html: "body" }] },
  },
  {
    name: "unknown mark",
    document: {
      ...textDocument(),
      content: [
        {
          type: "text",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "text", marks: [{ type: "script" }] }],
            },
          ],
        },
      ],
    },
  },
  {
    name: "empty text block",
    document: textDocument("   "),
    error: "emailTemplates.errors.invalidContent",
  },
  {
    name: "unknown variable",
    document: textDocument("{{unknown_variable}}"),
    error: "emailTemplates.errors.unsupportedVariables",
  },
  {
    name: "malformed variable",
    document: textDocument("{{broken"),
    error: "emailTemplates.errors.malformedVariables",
  },
  {
    name: "HTTP link",
    document: {
      ...textDocument(),
      content: [{ type: "button", attrs: { label: "Open", url: "http://example.com" } }],
    },
    error: "emailTemplates.errors.httpsRequired",
  },
  {
    name: "script link",
    document: {
      ...textDocument(),
      content: [{ type: "button", attrs: { label: "Open", url: "javascript:alert(1)" } }],
    },
    error: "emailTemplates.errors.httpsRequired",
  },
  {
    name: "invalid URL",
    document: {
      ...textDocument(),
      content: [{ type: "button", attrs: { label: "Open", url: "not-a-url" } }],
    },
    error: "emailTemplates.errors.invalidUrl",
  },
  {
    name: "private image",
    document: {
      ...textDocument(),
      content: [{ type: "image", attrs: { src: "https://127.0.0.1/image.png", alt: "Image" } }],
    },
    error: "emailTemplates.errors.privateImageHost",
  },
  {
    name: "oversized spacer",
    document: { ...textDocument(), content: [{ type: "spacer", attrs: { height: 201 } }] },
  },
];

describe("Email template preview and image HTTP endpoints (e2e)", () => {
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

  it.each(
    EMAIL_TEMPLATE_DEFINITIONS.flatMap((definition) =>
      languages.map((language) => ({ definition, language, event: definition.event })),
    ),
  )(
    "previews $event in $language without persistence or delivery",
    async ({ definition, language }) => {
      const response = await t
        .http("post", "/preview")
        .send({ ...previewBody(definition), language })
        .expect(201);
      expect(response.body.data).toMatchObject({
        event: definition.event,
        language,
        subject: expect.any(String),
        html: expect.any(String),
        text: expect.any(String),
        warnings: expect.any(Array),
      });
      expect(response.body.data.subject.trim()).not.toBe("");
      expect(response.body.data.html).toContain("data:image/png;base64,");
      expect(response.body.data.text.trim()).not.toBe("");
      expect(response.body.data.html).not.toContain("{{");
      expect(response.body.data.subject).not.toContain("{{");
      expect(
        await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(emailTemplates)),
      ).toEqual([]);
      expect(t.adapter.getAllEmails()).toEqual([]);
    },
  );

  it("falls back the whole preview and deduplicates translation/layout warnings", async () => {
    const body = {
      ...previewBody(),
      language: SUPPORTED_LANGUAGES.PL,
      subject: { en: "English subject", pl: "Incomplete Polish subject" },
      content: { en: textDocument("English body <script>bad</script>") },
    };
    const result = (await t.http("post", "/preview").send(body).expect(201)).body.data;
    expect(result).toMatchObject({ language: SUPPORTED_LANGUAGES.EN, subject: "English subject" });
    expect(result.html).toContain("English body");
    expect(result.html).not.toContain("<script>bad</script>");
    expect(result.warnings.sort()).toEqual(
      [
        "emailTemplates.warnings.translationFallback",
        "emailTemplates.warnings.missingHeader",
        "emailTemplates.warnings.missingFooter",
      ].sort(),
    );
  });

  it.each(["/preview", "/test-send"])(
    "rejects missing complete translations at %s",
    async (path) => {
      const enqueue = jest.spyOn(t.app.get(QueueService), "enqueue");
      const response = await t
        .http("post", path)
        .send({ ...previewBody(), subject: {}, content: {} })
        .expect(400);
      expect(response.body.message).toBe("emailTemplates.errors.incompleteBaseLanguage");
      expect(enqueue).not.toHaveBeenCalled();
    },
  );

  describe.each(["create", "update", "preview", "test-send"] as const)(
    "%s content validation",
    (operation) => {
      it.each(invalidDocuments)(
        "rejects $name without writes or queued mail",
        async ({ document, error }) => {
          const template = await t.create();
          const enqueue = jest.spyOn(t.app.get(QueueService), "enqueue");
          const content = { en: document };
          let req = t.http("post", `/${operation}`);
          let body: unknown = { ...previewBody(), content };
          if (operation === "create") {
            req = t.http("post");
            body = { ...draftBody(), content };
          }
          if (operation === "update") {
            req = t.http("patch", `/${template.id}`);
            body = { content };
          }
          const response = await req.send(body as object).expect(400);
          if (error) expect(response.body.message).toBe(error);
          expect(await t.get(template.id!)).toEqual(template);
          expect(
            await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(emailTemplates)),
          ).toHaveLength(1);
          expect(enqueue).not.toHaveBeenCalled();
          expect(t.adapter.getAllEmails()).toEqual([]);
        },
      );
    },
  );

  it.each(["/preview", "/test-send"])("rejects malformed request bodies at %s", async (path) => {
    for (const body of [
      {},
      { ...previewBody(), event: "unknown" },
      { ...previewBody(), language: "xx" },
      { ...previewBody(), recipient: "victim@example.com" },
      { ...previewBody(), subject: { xx: "Unknown" } },
    ]) {
      await t.http("post", path).send(body).expect(400);
    }
  });

  it.each(["png", "jpeg", "webp"] as const)(
    "uploads a valid %s into a private tenant resource",
    async (format) => {
      const image = await sharp(t.png).toFormat(format).toBuffer();
      const response = await t
        .http("post", "/images")
        .attach("file", image, { filename: `image.${format}`, contentType: `image/${format}` })
        .expect(201);
      const { resourceId, src, previewUrl } = response.body.data;
      expect(src).toBe(`asset:${resourceId}`);
      expect(previewUrl).toMatch(/^https:\/\/storage.example\//);
      const [resource] = await t.runAsTenant(t.defaultTenantId, () =>
        t.db.select().from(resources).where(eq(resources.id, resourceId)),
      );
      expect(resource).toMatchObject({
        uploadedBy: t.admin.id,
        tenantId: t.defaultTenantId,
        visibility: RESOURCE_VISIBILITY.PRIVATE,
        contentType: "image/webp",
      });
      expect(resource.reference).toMatch(new RegExp(`^${t.defaultTenantId}/email-templates/`));
      expect(resource.reference).toContain("/variants/");
      expect(
        [...t.storage.keys()].some((key) => key.includes("/variants/") && key.endsWith(".webp")),
      ).toBe(true);
      t.read.mockClear();
      expect((await t.http("get", `/images/${resourceId}`).expect(200)).body.data).toEqual(
        response.body.data,
      );
      expect(t.read).not.toHaveBeenCalled();
    },
  );

  it.each(["gif", "tiff"] as const)("rejects %s uploads before storage", async (format) => {
    const image = await sharp(t.png).toFormat(format).toBuffer();
    const before = await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(resources));
    await t
      .http("post", "/images")
      .attach("file", image, { filename: `image.${format}`, contentType: `image/${format}` })
      .expect(400);
    expect(t.upload).not.toHaveBeenCalled();
    expect(await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(resources))).toEqual(
      before,
    );
  });

  it("uses decoded PNG bytes for variant generation when the claimed MIME is JPEG", async () => {
    const response = await t
      .http("post", "/images")
      .attach("file", t.png, { filename: "image.jpg", contentType: "image/jpeg" })
      .expect(201);
    const [resource] = await t.runAsTenant(t.defaultTenantId, () =>
      t.db.select().from(resources).where(eq(resources.id, response.body.data.resourceId)),
    );
    expect(resource.contentType).toBe("image/webp");
    expect(resource.reference).toContain("/variants/");
  });

  it.each([
    "missing",
    "wrong-field",
    "multiple",
    "corrupt",
    "unsupported",
    "too-large",
    "too-many-pixels",
  ])("rejects %s image uploads without storing resources", async (kind) => {
    const before = await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(resources));
    const req = t.http("post", "/images");
    if (kind === "wrong-field") req.attach("wrong", t.png, "image.png");
    if (kind === "multiple") req.attach("file", t.png, "a.png").attach("file", t.png, "b.png");
    if (kind === "corrupt")
      req.attach("file", Buffer.from("not an image"), {
        filename: "image.png",
        contentType: "image/png",
      });
    if (kind === "unsupported")
      req.attach("file", Buffer.from("plain text"), {
        filename: "image.txt",
        contentType: "text/plain",
      });
    if (kind === "too-large")
      req.attach("file", Buffer.concat([t.png, Buffer.alloc(EMAIL_TEMPLATE_IMAGE_MAX_BYTES)]), {
        filename: "image.png",
        contentType: "image/png",
      });
    if (kind === "too-many-pixels") {
      const oversized = await sharp({
        create: { width: 4001, height: 4000, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      req.attach("file", oversized, { filename: "image.png", contentType: "image/png" });
    }
    await req.expect(kind === "too-large" ? 413 : 400);
    expect(t.upload).not.toHaveBeenCalled();
    expect(await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(resources))).toEqual(
      before,
    );
  });

  it.each(["malformed", "missing", "foreign", "wrong-folder", "external-reference", "wrong-type"])(
    "rejects %s image reads without signing or downloading",
    async (kind) => {
      let id: string = randomUUID();
      if (kind === "malformed") id = "bad-id";
      if (!["malformed", "missing"].includes(kind)) {
        const tenantId = kind === "foreign" ? t.otherTenant.id : t.defaultTenantId;
        let reference = `${tenantId}/email-templates/image`;
        if (kind === "wrong-folder") reference = `${tenantId}/lessons/image`;
        if (kind === "external-reference") reference = "https://external.example/image";
        await t.runAsTenant(tenantId, () =>
          t.db.insert(resources).values({
            id,
            reference,
            contentType: kind === "wrong-type" ? "application/pdf" : "image/png",
          }),
        );
      }
      const response = await t.http("get", `/images/${id}`).expect(400);
      if (kind !== "malformed") expect(response.body.message).toBe("files.toast.invalidData");
      expect(t.sign).not.toHaveBeenCalled();
      expect(t.read).not.toHaveBeenCalled();
    },
  );

  it("keeps asset references in saved and duplicated documents but embeds preview bytes", async () => {
    const asset = (await t.http("post", "/images").attach("file", t.png, "image.png").expect(201))
      .body.data;
    const body = draftBody();
    body.content.en!.content.push(
      { type: "image", attrs: { src: asset.src, alt: "Uploaded" } },
      { type: "image", attrs: { src: asset.src, alt: "Repeated" } },
    );
    const template = await t.create(body);
    const copy = (await t.http("post", `/${template.id}/duplicate`).expect(201)).body.data;
    expect(copy.content).toEqual(body.content);
    t.read.mockClear();
    const preview = (
      await t
        .http("post", "/preview")
        .send({ ...previewBody(), content: body.content })
        .expect(201)
    ).body.data;
    expect(preview.html).toContain("data:image/webp;base64,");
    expect(preview.html).not.toContain(asset.src);
    expect(preview.html).not.toContain("https://storage.example");
    expect(t.read).toHaveBeenCalledTimes(1);
    expect((await t.get(template.id!)).content).toEqual(body.content);
  });

  it.each(["create", "update", "preview", "publish", "duplicate"] as const)(
    "rejects foreign assets during %s",
    async (operation) => {
      const id = randomUUID();
      await t.runAsTenant(t.otherTenant.id, () =>
        t.db.insert(resources).values({
          id,
          reference: `${t.otherTenant.id}/email-templates/image`,
          contentType: "image/png",
        }),
      );
      const content = {
        en: {
          ...textDocument(),
          content: [{ type: "image", attrs: { src: `asset:${id}`, alt: "Foreign" } }],
        },
      } satisfies Record<string, EmailTemplateDocument>;
      const template = await t.create();
      let req = t.http("post", `/${operation}`);
      let body: object = { ...previewBody(), content };
      if (operation === "create") {
        req = t.http("post");
        body = { ...draftBody(), content };
      }
      if (operation === "update") {
        req = t.http("patch", `/${template.id}`);
        body = { content };
      }
      if (operation === "publish" || operation === "duplicate") {
        // Model a previously stored asset that is no longer accessible.
        await t.runAsTenant(t.defaultTenantId, () =>
          t.db.update(emailTemplates).set({ content }).where(eq(emailTemplates.id, template.id!)),
        );
        req = t.http("post", `/${template.id}/${operation}`);
        body = {};
      }
      const before = await t.get(template.id!);
      const response = await req.send(body).expect(400);
      expect(response.body.message).toBe("files.toast.invalidData");
      expect(await t.get(template.id!)).toEqual(before);
      expect(t.read).not.toHaveBeenCalled();
    },
  );
});
