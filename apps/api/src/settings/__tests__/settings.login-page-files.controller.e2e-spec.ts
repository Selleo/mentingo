import { eq } from "drizzle-orm";
import request from "supertest";

import { FileGuard } from "src/file/guards/file.guard";
import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { resourceEntity, resources } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { DatabasePg } from "../../common";
import type { INestApplication } from "@nestjs/common";

const validPdfBuffer = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
  "utf8",
);

describe("SettingsController - login page files (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let fileService: FileService;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;
  const testPassword = "Password123@@";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    fileService = app.get(FileService);
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);
  }, 20000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  describe("GET /api/settings/login-page-files", () => {
    beforeEach(async () => {
      await truncateTables(baseDb, ["settings"]);
      await globalSettingsFactory.create({ userId: null });
    });

    it("should return empty resources for public endpoint", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/settings/login-page-files")
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.resources).toEqual([]);
    });
  });

  describe("PATCH /api/settings/admin/login-page-files", () => {
    let adminUser: UserWithCredentials;
    let adminCookies: string[] | string;

    beforeEach(async () => {
      await truncateTables(baseDb, ["settings"]);
      await globalSettingsFactory.create({ userId: null });

      adminUser = await userFactory
        .withCredentials({ password: testPassword })
        .withAdminSettings(db)
        .create();

      const loginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
        email: adminUser.email,
        password: adminUser.credentials?.password,
      });
      adminCookies = loginResponse.headers["set-cookie"];
    });

    it("should reject non-admins with 403", async () => {
      const nonAdminUser = await userFactory
        .withCredentials({ password: testPassword })
        .withUserSettings(db)
        .create();
      const cookies = await cookieFor(nonAdminUser, app);

      await request(app.getHttpServer())
        .patch("/api/settings/admin/login-page-files")
        .set("Cookie", cookies)
        .field("name", "Login page info")
        .attach("file", validPdfBuffer, {
          filename: "login-info.pdf",
          contentType: "application/pdf",
        })
        .expect(403);
    });

    it("should allow admins to upload login page file and persist linked resource id", async () => {
      const fileTypeSpy = jest.spyOn(FileGuard, "getFileType").mockResolvedValue({
        ext: "pdf",
        mime: "application/pdf",
      });
      const uploadResourceSpy = jest
        .spyOn(fileService, "uploadResource")
        .mockImplementation(async ({ entityId, entityType, relationshipType, title, file, currentUser }: any) => {
          const [createdResource] = await db
            .insert(resources)
            .values({
              title: title ?? { en: "Untitled" },
              description: {},
              reference: `settings/login/${Date.now()}-${file.originalname}`,
              contentType: file.mimetype,
              uploadedBy: currentUser.userId,
            })
            .returning();

          await db.insert(resourceEntity).values({
            resourceId: createdResource.id,
            entityId,
            entityType,
            relationshipType,
          });

          return {
            resourceId: createdResource.id,
            fileKey: createdResource.reference,
            fileUrl: `https://cdn.test/${createdResource.reference}`,
          };
        });
      const getFileUrlSpy = jest
        .spyOn(fileService, "getFileUrl")
        .mockImplementation(async (reference: string) => `https://cdn.test/${reference}`);

      await request(app.getHttpServer())
        .patch("/api/settings/admin/login-page-files")
        .set("Cookie", Array.isArray(adminCookies) ? adminCookies : [adminCookies])
        .field("name", "Login page info")
        .attach("file", validPdfBuffer, {
          filename: "login-info.pdf",
          contentType: "application/pdf",
        })
        .expect(200);

      const settingsRow = await db.query.settings.findFirst({
        where: (s, { isNull }) => isNull(s.userId),
      });
      const loginPageFiles = (settingsRow?.settings as { loginPageFiles?: string[] })
        ?.loginPageFiles;

      expect(Array.isArray(loginPageFiles)).toBe(true);
      expect(loginPageFiles).toHaveLength(1);
      expect(typeof loginPageFiles?.[0]).toBe("string");

      fileTypeSpy.mockRestore();
      uploadResourceSpy.mockRestore();
      getFileUrlSpy.mockRestore();
    });
  });

  describe("DELETE /api/settings/login-page-files/:id", () => {
    let adminUser: UserWithCredentials;
    let adminCookies: string[] | string;

    beforeEach(async () => {
      await truncateTables(db, ["settings"]);
      await globalSettingsFactory.create({ userId: null });

      adminUser = await userFactory
        .withCredentials({ password: testPassword })
        .withAdminSettings(db)
        .create();

      const loginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
        email: adminUser.email,
        password: adminUser.credentials?.password,
      });
      adminCookies = loginResponse.headers["set-cookie"];
    });

    it("should delete a login page file and remove it from settings", async () => {
      const fileTypeSpy = jest.spyOn(FileGuard, "getFileType").mockResolvedValue({
        ext: "pdf",
        mime: "application/pdf",
      });
      const uploadResourceSpy = jest
        .spyOn(fileService, "uploadResource")
        .mockImplementation(async ({ entityId, entityType, relationshipType, title, file, currentUser }: any) => {
          const [createdResource] = await db
            .insert(resources)
            .values({
              title: title ?? { en: "Untitled" },
              description: {},
              reference: `settings/login/${Date.now()}-${file.originalname}`,
              contentType: file.mimetype,
              uploadedBy: currentUser.userId,
            })
            .returning();

          await db.insert(resourceEntity).values({
            resourceId: createdResource.id,
            entityId,
            entityType,
            relationshipType,
          });

          return {
            resourceId: createdResource.id,
            fileKey: createdResource.reference,
            fileUrl: `https://cdn.test/${createdResource.reference}`,
          };
        });
      const getFileUrlSpy = jest
        .spyOn(fileService, "getFileUrl")
        .mockImplementation(async (reference: string) => `https://cdn.test/${reference}`);

      await request(app.getHttpServer())
        .patch("/api/settings/admin/login-page-files")
        .set("Cookie", Array.isArray(adminCookies) ? adminCookies : [adminCookies])
        .field("name", "Login page info")
        .attach("file", validPdfBuffer, {
          filename: "login-info.pdf",
          contentType: "application/pdf",
        })
        .expect(200);

      const settingsBeforeDelete = await db.query.settings.findFirst({
        where: (s, { isNull }) => isNull(s.userId),
      });
      const loginPageFilesBeforeDelete = (settingsBeforeDelete?.settings as { loginPageFiles?: string[] })
        ?.loginPageFiles;
      const resourceId = loginPageFilesBeforeDelete?.[0];
      expect(resourceId).toBeDefined();
      const persistedResourceId = resourceId as string;

      await request(app.getHttpServer())
        .delete(`/api/settings/login-page-files/${persistedResourceId}`)
        .set("Cookie", Array.isArray(adminCookies) ? adminCookies : [adminCookies])
        .expect(200);

      const listAfterDelete = await request(app.getHttpServer())
        .get("/api/settings/login-page-files")
        .expect(200);

      expect(listAfterDelete.body.resources).toEqual([]);

      const settingsRow = await db.query.settings.findFirst({
        where: (s, { isNull }) => isNull(s.userId),
      });
      const loginPageFiles = (settingsRow?.settings as { loginPageFiles?: string[] })
        ?.loginPageFiles;

      expect(loginPageFiles ?? []).not.toContain(resourceId);

      const relations = await db
        .select({ resourceId: resourceEntity.resourceId })
        .from(resourceEntity)
        .where(eq(resourceEntity.resourceId, persistedResourceId));

      expect(relations).toEqual([]);

      fileTypeSpy.mockRestore();
      uploadResourceSpy.mockRestore();
      getFileUrlSpy.mockRestore();
    });

    it("should return 400 when deleting a non-existent login page file resource", async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/settings/login-page-files/${crypto.randomUUID()}`)
        .set("Cookie", Array.isArray(adminCookies) ? adminCookies : [adminCookies])
        .expect(400);

      expect(response.body.message).toBe("loginFilesUpload.toast.resourceNotFound");
    });
  });
});
