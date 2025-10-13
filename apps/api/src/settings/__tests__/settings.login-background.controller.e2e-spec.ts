import request from "supertest";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { truncateTables, cookieFor } from "../../../test/helpers/test-helpers";

import type { DatabasePg } from "../../common";
import type { INestApplication } from "@nestjs/common";

describe("SettingsController - login background (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;
  const testPassword = "Password123@@";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get("DB");
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);
  }, 20000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  describe("GET /api/settings/login-background", () => {
    beforeEach(async () => {
      await truncateTables(db, ["settings"]);
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

    it("should reject non-admins with 403", async () => {
      const nonAdminUser = await userFactory
        .withCredentials({ password: testPassword })
        .withUserSettings(db)
        .create();
      const cookies = await cookieFor(nonAdminUser, app);

      await request(app.getHttpServer())
        .patch("/api/settings/login-background")
        .set("Cookie", cookies)
        .attach("login-background", Buffer.from("test"), {
          filename: "bg.png",
          contentType: "image/png",
        })
        .expect(403);
    });

    it("should allow admins to upload login background and then GET should return url", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/login-background")
        .set("Cookie", Array.isArray(adminCookies) ? adminCookies : [adminCookies])
        .attach("login-background", Buffer.from("test"), {
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
