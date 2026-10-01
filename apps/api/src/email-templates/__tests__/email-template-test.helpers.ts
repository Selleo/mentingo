import { randomUUID } from "node:crypto";

import { EMAIL_TEMPLATE_DEFINITIONS, EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { isNull } from "drizzle-orm";
import sharp from "sharp";
import request from "supertest";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { FileService } from "src/file/file.service";
import { FileGuard } from "src/file/guards/file.guard";
import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";
import { DB } from "src/storage/db/db.providers";
import { emailTemplates, resources, settings, tenants } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../test/helpers/e2e-settings";
import { cookieFor } from "../../../test/helpers/test-helpers";
import { EmailTemplateTestWorker } from "../email-template-test.worker";

import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type {
  CreateEmailTemplateBody,
  EmailTemplateResponse,
  PreviewEmailTemplateBody,
} from "../schemas/email-template.schema";
import type { EmailTemplateDefinition, EmailTemplateDocument } from "@repo/email-templates";
import type { DatabasePg } from "src/common";

export const ROOT = "/api/email-templates";
export const welcome = EMAIL_TEMPLATE_DEFINITIONS.find(
  ({ event }) => event === EMAIL_TEMPLATE_EVENTS.WELCOME,
)!;
export const languages = Object.values(SUPPORTED_LANGUAGES);

export const draftBody = (definition: EmailTemplateDefinition = welcome): CreateEmailTemplateBody =>
  structuredClone({
    event: definition.event,
    name: definition.name,
    subject: definition.subjects,
    content: definition.defaultDocuments,
    baseLanguage: definition.defaultLanguage,
  });

export const previewBody = (
  definition: EmailTemplateDefinition = welcome,
): PreviewEmailTemplateBody => {
  const { event, subject, content, baseLanguage } = draftBody(definition);
  return { event, subject, content, baseLanguage: baseLanguage!, language: SUPPORTED_LANGUAGES.EN };
};

export const textDocument = (text = "Template body"): EmailTemplateDocument => ({
  type: "doc",
  version: 1,
  content: [{ type: "text", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }],
});

export async function setupEmailTemplateTest(options: { worker?: boolean } = {}) {
  const originalRateLimit = process.env.DISABLE_RATE_LIMITING;
  process.env.DISABLE_RATE_LIMITING = "true";
  const storage = new Map<string, Buffer>();
  const s3Service = {
    uploadFile: jest.fn(async (buffer: Buffer, key: string) => {
      storage.set(key, Buffer.from(buffer));
    }),
    getSignedUrl: jest.fn(async (key: string) => `https://storage.example/${key}`),
    getFileBuffer: jest.fn(async (key: string) => {
      const buffer = storage.get(key);
      if (!buffer) throw new Error(`Missing test object: ${key}`);
      return buffer;
    }),
  };
  const context = await createE2ETest({
    useDbProxy: true,
    customProviders: [
      { provide: S3Service, useValue: s3Service },
      ...(!options.worker ? [{ provide: EmailTemplateTestWorker, useValue: {} }] : []),
    ],
  });
  const { app, defaultTenantId, runAsTenant } = context;
  const close = app.close.bind(app);
  app.close = async () => {
    try {
      await close();
    } finally {
      if (originalRateLimit === undefined) delete process.env.DISABLE_RATE_LIMITING;
      else process.env.DISABLE_RATE_LIMITING = originalRateLimit;
    }
  };
  const db = app.get<DatabasePg>(DB);
  const adapter = app.get<EmailTestingAdapter>(EmailAdapter);
  const fileService = app.get(FileService);
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#123456" } })
    .png()
    .toBuffer();

  jest.spyOn(FileGuard, "getFileType").mockImplementation(async (file) => {
    try {
      const buffer = Buffer.isBuffer(file) ? file : file.buffer;
      const { format } = await sharp(buffer).metadata();
      if (format === "jpeg") return { ext: "jpg", mime: "image/jpeg" };
      if (format === "png") return { ext: "png", mime: "image/png" };
      if (format === "gif") return { ext: "gif", mime: "image/gif" };
      if (format === "webp") return { ext: "webp", mime: "image/webp" };
      if (format === "tiff") return { ext: "tif", mime: "image/tiff" };
      return undefined;
    } catch {
      return undefined;
    }
  });

  const upload = jest.spyOn(fileService, "uploadFile");
  const sign = jest.spyOn(fileService, "getFileUrl");
  const read = jest.spyOn(fileService, "getRawFileBuffer");
  const settingsService = app.get(SettingsService);
  jest.spyOn(settingsService, "getPlatformLogoBuffer").mockResolvedValue(png);
  jest.spyOn(settingsService, "getEmailBorderCircleBuffer").mockResolvedValue(png);

  const admin = await runAsTenant(defaultTenantId, () =>
    createUserFactory(db)
      .withCredentials({ password: "Password123!" })
      .withAdminSettings(db)
      .create({ tenantId: defaultTenantId }),
  );
  const student = await runAsTenant(defaultTenantId, () =>
    createUserFactory(db)
      .withCredentials({ password: "Password123!" })
      .withUserSettings(db)
      .create({ tenantId: defaultTenantId }),
  );
  const adminCookie = await cookieFor(admin, app);
  const studentCookie = await cookieFor(student, app);
  // Administrative setup is the only cross-tenant DB operation in this helper.
  const [otherTenant] = await context.dbAdmin
    .insert(tenants)
    .values({ name: "Email HTTP tenant", host: `https://${randomUUID()}.example` })
    .returning();
  const otherAdmin = await runAsTenant(otherTenant.id, async () => {
    await createSettingsFactory(db).create({ userId: null });
    return createUserFactory(db)
      .withCredentials({ password: "Password123!" })
      .withAdminSettings(db)
      .create({ tenantId: otherTenant.id });
  });
  const otherCookie = await cookieFor(otherAdmin, app, otherTenant.host);

  const http = (
    method: "get" | "post" | "patch" | "delete",
    path = "",
    cookie = adminCookie,
    host?: string,
  ) => {
    const req = request(app.getHttpServer())[method](`${ROOT}${path}`);
    if (cookie) req.set("Cookie", cookie);
    if (host) req.set("Referer", `${host}/`);
    return req;
  };
  const create = async (body = draftBody()) => {
    const response = await http("post").send(body).expect(201);
    return response.body.data as EmailTemplateResponse;
  };
  const get = async (id: string) =>
    (await http("get", `/${id}`).expect(200)).body.data as EmailTemplateResponse;
  const reset = async () => {
    for (const tenantId of [defaultTenantId, otherTenant.id]) {
      await runAsTenant(tenantId, async () => {
        await db.delete(emailTemplates);
        await db.delete(resources);
        await db
          .update(settings)
          .set({ settings: settingsToJSONBuildObject(DEFAULT_E2E_GLOBAL_SETTINGS) })
          .where(isNull(settings.userId));
      });
    }
    storage.clear();
    adapter.clearEmails();
    jest.clearAllMocks();
  };
  return {
    ...context,
    db,
    adapter,
    admin,
    student,
    adminCookie,
    studentCookie,
    otherTenant,
    otherAdmin,
    otherCookie,
    http,
    create,
    get,
    reset,
    png,
    storage,
    upload,
    sign,
    read,
  };
}

export type EmailTemplateTestContext = Awaited<ReturnType<typeof setupEmailTemplateTest>>;
