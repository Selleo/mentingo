import request from "supertest";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { truncateTables, cookieFor } from "../../../test/helpers/test-helpers";

import type { DatabasePg } from "../../common";
import type { INestApplication } from "@nestjs/common";
import type { AdminSettings } from "src/common/types";

describe("SettingsController (e2e)", () => {
  let app: INestApplication;
  let testUser: UserWithCredentials;
  let testCookies: string;
  const testPassword = "Password123@@";
  let db: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get("DB");
    userFactory = createUserFactory(db);
  }, 10000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  describe("PUT /api/settings", () => {
    beforeEach(async () => {
      await truncateTables(db, ["settings"]);

      testUser = await userFactory
        .withCredentials({ password: testPassword })
        .withUserSettings(db)
        .create();

      testCookies = await cookieFor(testUser, app);
    });

    it("should update user settings (e.g., change language)", async () => {
      const updatePayload = {
        language: "de",
      };

      const response = await request(app.getHttpServer())
        .put("/api/settings")
        .set("Cookie", testCookies)
        .send(updatePayload)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data.language).toBe("de");

      const updatedSettingInDb = await db.query.settings.findFirst({
        where: (s, { eq }) => eq(s.userId, testUser.id),
      });

      expect(updatedSettingInDb).toBeDefined();
      expect(updatedSettingInDb?.settings.language).toBe("de");
    });

    it("should return 400 if invalid data is provided", async () => {
      const invalidRequestBody = {
        admin_new_user_notification: "not_a_boolean",
        language: 123,
      };

      await request(app.getHttpServer())
        .put("/api/settings")
        .set("Cookie", testCookies)
        .send(invalidUpdatePayload)
        .expect(400);
    });

    it("should return 401 if not authenticated", async () => {
      const updatePayload = {
        language: "de",
      };

      await request(app.getHttpServer()).put("/api/settings").send(updatePayload).expect(401);
    });
  });

  describe("PATCH /api/settings/admin-new-user-notification", () => {
    let adminUser: UserWithCredentials;
    let adminCookies: string;

    beforeEach(async () => {
      await truncateTables(db, ["settings"]);

      adminUser = await userFactory
        .withCredentials({ password: testPassword })
        .withAdminSettings(db)
        .create();

      adminCookies = await cookieFor(adminUser, app);
    });

    it("should toggle the notification setting (as Admin)", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/settings/admin-new-user-notification")
        .set("Cookie", adminCookies)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data.adminNewUserNotification).toBe(true);

      const updatedSettingInDb = await db.query.settings.findFirst({
        where: (s, { eq }) => eq(s.userId, adminUser.id),
      });

      const adminSettings = updatedSettingInDb?.settings as AdminSettings;
      expect(adminSettings?.adminNewUserNotification).toBe(true);

      const secondResponse = await request(app.getHttpServer())
        .patch("/api/settings/admin-new-user-notification")
        .set("Cookie", adminCookies)
        .expect(200);

      expect(secondResponse.body.data.adminNewUserNotification).toBe(false);

      const toggledBackSettingInDb = await db.query.settings.findFirst({
        where: (s, { eq }) => eq(s.userId, adminUser.id),
      });

      const toggledAdminSettings = toggledBackSettingInDb?.settings as AdminSettings;
      expect(toggledAdminSettings?.adminNewUserNotification).toBe(false);
    });

    it("should return 403 if user is not an admin", async () => {
      const nonAdminUser = await userFactory
        .withCredentials({ password: testPassword })
        .withUserSettings(db)
        .create();

      const nonAdminCookies = await cookieFor(nonAdminUser, app);

      await request(app.getHttpServer())
        .patch("/api/settings/admin-new-user-notification")
        .set("Cookie", nonAdminCookies)
        .expect(403);
    });
  });

  describe("GET /api/settings", () => {
    beforeEach(async () => {
      await truncateTables(db, ["settings"]);

      testUser = await userFactory
        .withCredentials({ password: testPassword })
        .withUserSettings(db)
        .create();

      testCookies = await cookieFor(testUser, app);
    });

    it("should return user settings", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/settings")
        .set("Cookie", testCookies)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data).toBeDefined();
    });
  });
});
