import request from "supertest";

import { settings } from "../../../src/storage/schema";
import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";

import type { DatabasePg } from "../../common";
import type { SettingsJSONContentSchema } from "../schemas/settings.schema";
import type { INestApplication } from "@nestjs/common";

describe("SettingsController (e2e)", () => {
  let app: INestApplication;
  let testUser: UserWithCredentials;
  let testCookies: string;
  const testPassword = "Password123@@";
  let db: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get("DB");
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
  }, 10000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  beforeEach(async () => {
    await db.delete(settings);

    testUser = await userFactory.withCredentials({ password: testPassword }).create();

    const testLoginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
      email: testUser.email,
      password: testUser.credentials?.password,
    });

    testCookies = testLoginResponse.headers["set-cookie"];
  });

  describe("POST /settings", () => {
    it("should create new settings for a user.", async () => {
      const requestBody = settingsFactory.build().settings as SettingsJSONContentSchema;

      const response = await request(app.getHttpServer())
        .post("/api/settings")
        .set("Cookie", testCookies)
        .send(requestBody)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.data.userId).toBe(testUser.id);
      expect(response.body.data.settings).toEqual(requestBody);
      expect(response.body.data.createdAt).toBeDefined();

      const createdSettingInDb = await db.query.settings.findFirst({
        where: (s, { eq }) => eq(s.userId, testUser.id),
      });

      expect(createdSettingInDb).toBeDefined();
      expect(createdSettingInDb?.userId).toBe(testUser.id);
      expect(createdSettingInDb?.settings).toEqual(requestBody);
    });

    it("should return 401 if not authenticated", async () => {
      const requestBody = settingsFactory.build().settings as SettingsJSONContentSchema;
      await request(app.getHttpServer()).post("/api/settings").send(requestBody).expect(401);
    });

    it("should return 400 if invalid data is provided", async () => {
      const invalidRequestBody = {
        admin_new_user_notification: "not_a_boolean",
        language: 123,
      };

      await request(app.getHttpServer())
        .post("/api/settings")
        .set("Cookie", testCookies)
        .send(invalidRequestBody)
        .expect(400);
    });
  });

  describe("GET /settings", () => {
    it("should return user settings", async () => {
      const existingSettings = await settingsFactory.create({ userId: testUser.id });

      const response = await request(app.getHttpServer())
        .get("/api/settings")
        .set("Cookie", testCookies)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.settings).toEqual(existingSettings.settings);
      expect(response.body.createdAt).toBeDefined();
    });

    it("should return 404 if settings do not exist for the user", async () => {
      await request(app.getHttpServer())
        .get("/api/settings")
        .set("Cookie", testCookies)
        .expect(404);
    });
  });
});
