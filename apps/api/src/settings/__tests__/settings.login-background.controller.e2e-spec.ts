import request from "supertest";

import { DB, DB_BASE } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { truncateTables, cookieFor } from "../../../test/helpers/test-helpers";

import type { DatabasePg } from "../../common";
import type { INestApplication } from "@nestjs/common";

const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb1, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("SettingsController - login background (e2e)", () => {
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
    baseDb = app.get(DB_BASE);
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);
  }, 20000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  describe("GET /api/settings/login-background", () => {
    beforeEach(async () => {
      await truncateTables(baseDb, ["settings"]);
      await globalSettingsFactory.create({ userId: null });
    });

    it("should return public login background url (null by default)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/settings/login-background")
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data).toEqual({ url: null });
    });
  });

  describe("PATCH /api/settings/login-background", () => {
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
        .patch("/api/settings/login-background")
        .set("Cookie", cookies)
        .attach("login-background", validPngBuffer, {
          filename: "bg.png",
          contentType: "image/png",
        })
        .expect(403);
    });

    it.skip("should allow admins to upload login background and then GET should return url", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/login-background")
        .set("Cookie", Array.isArray(adminCookies) ? adminCookies : [adminCookies])
        .attach("login-background", validPngBuffer, {
          filename: "bg.png",
          contentType: "image/png",
        })
        .expect(200);

      const getResponse = await request(app.getHttpServer())
        .get("/api/settings/login-background")
        .expect(200);

      expect(getResponse.body).toBeDefined();
      expect(getResponse.body.data).toHaveProperty("url");
    });
  });
});
