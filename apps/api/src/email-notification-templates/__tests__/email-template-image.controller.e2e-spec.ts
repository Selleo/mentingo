import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";

import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_TEST_TENANT_HOST } from "../../../test/helpers/tenant-helpers";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb1, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

const TENANT_HOST = DEFAULT_TEST_TENANT_HOST;

describe("EmailTemplateImageController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  const password = "Password123@@";

  const mockFileService = {
    uploadFile: jest.fn(),
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest([
      { provide: FileService, useValue: mockFileService },
    ]);
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  beforeEach(async () => {
    jest.clearAllMocks();
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  describe("POST /api/email-notification-templates/images", () => {
    it("returns 401 when not authenticated", async () => {
      await request(app.getHttpServer())
        .post("/api/email-notification-templates/images")
        .attach("file", validPngBuffer, { filename: "photo.png", contentType: "image/png" })
        .expect(401);
    });

    it("returns 403 when user lacks EMAIL_TEMPLATE_MANAGE permission", async () => {
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

      await request(app.getHttpServer())
        .post("/api/email-notification-templates/images")
        .set("Cookie", await cookieFor(student, app))
        .attach("file", validPngBuffer, { filename: "photo.png", contentType: "image/png" })
        .expect(403);
    });

    it("returns proxy URL on authenticated PNG upload", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      const fileKey = `tenant-id/email_template_image/variants/uuid.webp`;
      mockFileService.uploadFile.mockResolvedValue({
        fileKey,
        fileUrl: "https://s3.example.com/uuid.webp",
        contentType: "image/webp",
      });

      const response = await request(app.getHttpServer())
        .post("/api/email-notification-templates/images")
        .set("Cookie", await cookieFor(admin, app))
        .attach("file", validPngBuffer, { filename: "photo.png", contentType: "image/png" })
        .expect(201);

      const { url } = response.body.data;
      expect(url).toContain("/api/public/email-template-image/");
      expect(url).toContain(TENANT_HOST);
      expect(url).toContain(encodeURIComponent(fileKey));
    });

    it("rejects a file exceeding 10 MB with 400", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      const oversizedPngBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 0x89);

      await request(app.getHttpServer())
        .post("/api/email-notification-templates/images")
        .set("Cookie", await cookieFor(admin, app))
        .attach("file", oversizedPngBuffer, { filename: "big.png", contentType: "image/png" })
        .expect(400);
    });

    it("rejects a PDF with 400", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      const fakePdfBuffer = Buffer.from("%PDF-1.4 fake pdf content");

      await request(app.getHttpServer())
        .post("/api/email-notification-templates/images")
        .set("Cookie", await cookieFor(admin, app))
        .attach("file", fakePdfBuffer, { filename: "doc.pdf", contentType: "application/pdf" })
        .expect(400);
    });
  });
});
