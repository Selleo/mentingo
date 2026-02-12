import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { DatabasePg } from "../../common";
import type { INestApplication } from "@nestjs/common";

const validPdfBuffer = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDAvS2lkc1tdPj4KZW5kb2JqCnhyZWYKMCAzCjAwMDAwMDAwMDAgNjU1MzUgZgowMDAwMDAwMDA5IDAwMDAwIG4KMDAwMDAwMDA1OCAwMDAwMCBuCnRyYWlsZXI8PC9TaXplIDMvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoxMTYKJSVFT0Y=",
  "base64",
);

describe("SettingsController - login page files (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;
  const testPassword = "Password123@@";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
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

    it.skip("should allow admins to upload and list login page files", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/admin/login-page-files")
        .set("Cookie", Array.isArray(adminCookies) ? adminCookies : [adminCookies])
        .field("name", "Login page info")
        .attach("file", validPdfBuffer, {
          filename: "login-info.pdf",
          contentType: "application/pdf",
        })
        .expect(200);

      const listResponse = await request(app.getHttpServer())
        .get("/api/settings/login-page-files")
        .expect(200);

      expect(listResponse.body).toBeDefined();
      expect(listResponse.body.resources).toHaveLength(1);
      expect(listResponse.body.resources[0]).toMatchObject({
        name: "Login page info",
      });

      const settingsRow = await db.query.settings.findFirst({
        where: (s, { isNull }) => isNull(s.userId),
      });
      const loginPageFiles = (settingsRow?.settings as { loginPageFiles?: string[] })
        ?.loginPageFiles;

      expect(Array.isArray(loginPageFiles)).toBe(true);
      expect(loginPageFiles).toContain(listResponse.body.resources[0].id);
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

    it.skip("should delete a login page file and remove it from settings", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/admin/login-page-files")
        .set("Cookie", Array.isArray(adminCookies) ? adminCookies : [adminCookies])
        .field("name", "Login page info")
        .attach("file", validPdfBuffer, {
          filename: "login-info.pdf",
          contentType: "application/pdf",
        })
        .expect(200);

      const listResponse = await request(app.getHttpServer())
        .get("/api/settings/login-page-files")
        .expect(200);

      const resourceId = listResponse.body.resources[0]?.id;
      expect(resourceId).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/api/settings/login-page-files/${resourceId}`)
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
    });
  });
});
