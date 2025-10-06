import request from "supertest";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { truncateTables, cookieFor } from "../../../test/helpers/test-helpers";

import type { DatabasePg } from "../../common";
import type { INestApplication } from "@nestjs/common";
import type { AdminSettings, GlobalSettings, StudentSettings } from "src/common/types";

describe("SettingsController (e2e)", () => {
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
  }, 10000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  describe("User Settings", () => {
    let testUser: UserWithCredentials;
    let testCookies: string;

    describe("PUT /api/settings", () => {
      beforeEach(async () => {
        await truncateTables(db, ["settings"]);
        await globalSettingsFactory.create({ userId: null });

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

        const userSettings = updatedSettingInDb?.settings as StudentSettings;

        expect(updatedSettingInDb).toBeDefined();
        expect(userSettings?.language).toBe("de");
      });

      it("should return 400 if invalid data is provided", async () => {
        const invalidUpdatePayload = {
          language: 12345,
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

    describe("PATCH /api/settings/admin/new-user-notification", () => {
      let adminUser: UserWithCredentials;
      let adminCookies: string;

      beforeEach(async () => {
        await truncateTables(db, ["settings"]);
        await globalSettingsFactory.create({ userId: null });

        adminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withAdminSettings(db)
          .create();

        const adminLoginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
          email: adminUser.email,
          password: adminUser.credentials?.password,
        });

        adminCookies = adminLoginResponse.headers["set-cookie"];
      });

      it("should toggle the notification setting (as Admin)", async () => {
        const initialSettingInDb = await db.query.settings.findFirst({
          where: (s, { eq }) => eq(s.userId, adminUser.id),
        });

        const initialAdminSettings = initialSettingInDb?.settings as AdminSettings;
        const initialNotificationState = initialAdminSettings?.adminNewUserNotification ?? false;

        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/new-user-notification")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.data.adminNewUserNotification).toBe(!initialNotificationState);

        const updatedSettingInDb = await db.query.settings.findFirst({
          where: (s, { eq }) => eq(s.userId, adminUser.id),
        });

        const adminSettings = updatedSettingInDb?.settings as AdminSettings;
        expect(adminSettings?.adminNewUserNotification).toBe(!initialNotificationState);

        await request(app.getHttpServer())
          .patch("/api/settings/admin/new-user-notification")
          .set("Cookie", adminCookies)
          .expect(200);

        const toggledBackSettingInDb = await db.query.settings.findFirst({
          where: (s, { eq }) => eq(s.userId, adminUser.id),
        });

        const toggledAdminSettings = toggledBackSettingInDb?.settings as AdminSettings;
        expect(toggledAdminSettings?.adminNewUserNotification).toBe(initialNotificationState);
      });

      it("should return 403 if user is not an admin", async () => {
        const nonAdminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();

        const nonAdminCookies = await cookieFor(nonAdminUser, app);

        await request(app.getHttpServer())
          .patch("/api/settings/admin/new-user-notification")
          .set("Cookie", nonAdminCookies)
          .expect(403);
      });
    });

    describe("GET /settings", () => {
      beforeEach(async () => {
        await truncateTables(db, ["settings"]);
        await globalSettingsFactory.create({ userId: null });

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

  describe("Global Settings", () => {
    describe("GET /api/settings/global", () => {
      it("should return global settings without authentication (public endpoint)", async () => {
        const response = await request(app.getHttpServer()).get("/api/settings/global").expect(200);

        expect(response.body).toBeDefined();
        expect(response.body.data).toBeDefined();
        expect(response.body.data.unregisteredUserCoursesAccessibility).toBeDefined();
      });

      it("should return updated global settings after admin changes via PATCH endpoint", async () => {
        const adminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withAdminSettings(db)
          .create();

        const adminCookies = await cookieFor(adminUser, app);

        const initialResponse = await request(app.getHttpServer())
          .get("/api/settings/global")
          .expect(200);

        const initialValue = initialResponse.body.data.unregisteredUserCoursesAccessibility;

        await request(app.getHttpServer())
          .patch("/api/settings/admin/unregistered-user-courses-accessibility")
          .set("Cookie", adminCookies)
          .expect(200);

        const updatedResponse = await request(app.getHttpServer())
          .get("/api/settings/global")
          .expect(200);

        expect(updatedResponse.body.data.unregisteredUserCoursesAccessibility).toBe(!initialValue);
      });
    });

    describe("PATCH /api/settings/admin/unregistered-user-courses-accessibility", () => {
      let adminUser: UserWithCredentials;
      let adminCookies: string;

      beforeEach(async () => {
        await truncateTables(db, ["settings"]);
        await globalSettingsFactory.create({ userId: null });

        adminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withAdminSettings(db)
          .create();

        await globalSettingsFactory.create();
        adminCookies = await cookieFor(adminUser, app);
      });

      afterEach(async () => {
        await truncateTables(db, ["settings"]);
      });

      it("should toggle the global unregistered user courses accessibility setting (as Admin)", async () => {
        const initialGlobalSettings = await db.query.settings.findFirst({
          where: (s, { isNull }) => isNull(s.userId),
        });

        const globalSettings = initialGlobalSettings?.settings as GlobalSettings;
        const initialValue = globalSettings?.unregisteredUserCoursesAccessibility ?? true;

        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/unregistered-user-courses-accessibility")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.unregisteredUserCoursesAccessibility).toBe(!initialValue);

        const toggleResponse = await request(app.getHttpServer())
          .patch("/api/settings/admin/unregistered-user-courses-accessibility")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(toggleResponse.body.data.unregisteredUserCoursesAccessibility).toBe(initialValue);
      });

      it("should return 403 if user is not an admin", async () => {
        const nonAdminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();

        const nonAdminCookies = await cookieFor(nonAdminUser, app);

        await request(app.getHttpServer())
          .patch("/api/settings/admin/unregistered-user-courses-accessibility")
          .set("Cookie", nonAdminCookies)
          .expect(403);
      });

      it("should return 401 if not authenticated", async () => {
        await request(app.getHttpServer())
          .patch("/api/settings/admin/unregistered-user-courses-accessibility")
          .expect(401);
      });
    });

    describe("PATCH /api/settings/admin/enforce-sso", () => {
      let adminUser: UserWithCredentials;
      let adminCookies: string;

      beforeEach(async () => {
        await truncateTables(db, ["settings"]);
        await globalSettingsFactory.create({ userId: null });

        adminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withAdminSettings(db)
          .create();

        adminCookies = await cookieFor(adminUser, app);
      });

      afterEach(async () => {
        await truncateTables(db, ["settings"]);
      });

      it("should toggle the global enforce SSO setting (as Admin)", async () => {
        const initialGlobalSettings = await db.query.settings.findFirst({
          where: (s, { isNull }) => isNull(s.userId),
        });

        const globalSettings = initialGlobalSettings?.settings as GlobalSettings;
        const initialValue = globalSettings?.enforceSSO ?? false;

        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/enforce-sso")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.enforceSSO).toBe(!initialValue);

        const toggleResponse = await request(app.getHttpServer())
          .patch("/api/settings/admin/enforce-sso")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(toggleResponse.body.data.enforceSSO).toBe(initialValue);
      });

      it("should return 403 if user is not an admin", async () => {
        const nonAdminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();

        const nonAdminCookies = await cookieFor(nonAdminUser, app);

        await request(app.getHttpServer())
          .patch("/api/settings/admin/enforce-sso")
          .set("Cookie", nonAdminCookies)
          .expect(403);
      });

      it("should return 401 if not authenticated", async () => {
        await request(app.getHttpServer()).patch("/api/settings/admin/enforce-sso").expect(401);
      });
    });

    describe("PATCH /api/settings/admin/primary-color", () => {
      let adminUser: UserWithCredentials;
      let adminCookies: string;

      beforeEach(async () => {
        await truncateTables(db, ["settings"]);
        await globalSettingsFactory.create({ userId: null });

        adminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withAdminSettings(db)
          .create();

        adminCookies = await cookieFor(adminUser, app);
      });

      afterEach(async () => {
        await truncateTables(db, ["settings"]);
      });

      it("should update the global primary color setting (as Admin)", async () => {
        const newColor = "#123456";

        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/primary-color")
          .set("Cookie", adminCookies)
          .send({ primaryColor: newColor })
          .expect(200);

        expect(response.body.data.primaryColor).toBe(newColor);

        const updatedGlobalSettings = await db.query.settings.findFirst({
          where: (s, { isNull }) => isNull(s.userId),
        });

        const globalSettings = updatedGlobalSettings?.settings as GlobalSettings;
        expect(globalSettings?.primaryColor).toBe(newColor);
      });

      it("should return 400 if invalid color format is provided", async () => {
        const invalidColor = "123456";

        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/primary-color")
          .set("Cookie", adminCookies)
          .send({ primaryColor: invalidColor })
          .expect(400);

        expect(response.body).toEqual(
          expect.objectContaining({
            message: "Validation failed (body)",
            errors: expect.arrayContaining([
              expect.objectContaining({
                message: expect.stringMatching(/Expected string to match/i),
                value: invalidColor,
              }),
            ]),
          }),
        );
      });

      it("should return 403 if user is not an admin", async () => {
        const nonAdminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();

        const nonAdminCookies = await cookieFor(nonAdminUser, app);

        await request(app.getHttpServer())
          .patch("/api/settings/admin/primary-color")
          .set("Cookie", nonAdminCookies)
          .send({ primaryColor: "#123456" })
          .expect(403);
      });

      it("should return 401 if not authenticated", async () => {
        await request(app.getHttpServer())
          .patch("/api/settings/admin/primary-color")
          .send({ primaryColor: "#123456" })
          .expect(401);
      });
    });
  });
});
