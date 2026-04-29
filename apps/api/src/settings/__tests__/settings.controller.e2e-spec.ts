import { Readable } from "stream";

import { isNull, sql } from "drizzle-orm";
import sharp from "sharp";
import request from "supertest";

import { FileService } from "src/file/file.service";
import { FILE_DELIVERY_TYPE } from "src/file/types/file-delivery.type";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { settings } from "src/storage/schema";

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
  let baseDb: DatabasePg;
  let fileService: FileService;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;
  let validPngBuffer: Buffer;
  const testPassword = "Password123@@";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    fileService = app.get(FileService);
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);
    validPngBuffer = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("User Settings", () => {
    let testUser: UserWithCredentials;
    let testCookies: string;

    describe("PUT /api/settings", () => {
      beforeEach(async () => {
        await truncateTables(baseDb, ["settings", "outbox_events"]);
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
        await truncateTables(baseDb, ["settings", "outbox_events"]);
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
        await truncateTables(db, ["settings", "outbox_events"]);
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
    beforeEach(async () => {
      await truncateTables(baseDb, ["form_field_answers", "form_fields", "forms", "settings"]);
      await globalSettingsFactory.create({ userId: null });
    });

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

      it("should return versioned settings image URLs for configured assets", async () => {
        const platformLogoKey = "platform-logos/logo.png";
        const simpleLogoKey = "platform-simple-logos/simple.svg";
        const loginBackgroundKey = "login-backgrounds/login.jpg";
        const certificateBackgroundKey = "certificate-backgrounds/certificate.png";

        await db
          .update(settings)
          .set({
            settings: sql`
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      settings.settings,
                      '{platformLogoS3Key}',
                      to_jsonb(${platformLogoKey}::text),
                      true
                    ),
                    '{platformSimpleLogoS3Key}',
                    to_jsonb(${simpleLogoKey}::text),
                    true
                  ),
                  '{loginBackgroundImageS3Key}',
                  to_jsonb(${loginBackgroundKey}::text),
                  true
                ),
                '{certificateBackgroundImage}',
                to_jsonb(${certificateBackgroundKey}::text),
                true
              )
            `,
          })
          .where(isNull(settings.userId));

        const response = await request(app.getHttpServer()).get("/api/settings/global").expect(200);

        expect(response.body.data.platformLogoS3Key).toBe(
          `/api/settings/platform-logo/image?v=${encodeURIComponent(platformLogoKey)}`,
        );
        expect(response.body.data.platformSimpleLogoS3Key).toBe(
          `/api/settings/platform-simple-logo/image?v=${encodeURIComponent(simpleLogoKey)}`,
        );
        expect(response.body.data.loginBackgroundImageS3Key).toBe(
          `/api/settings/login-background/image?v=${encodeURIComponent(loginBackgroundKey)}`,
        );
        expect(response.body.data.certificateBackgroundImage).toBe(
          `/api/settings/certificate-background/image?v=${encodeURIComponent(certificateBackgroundKey)}`,
        );
      });
    });

    describe("PATCH /api/settings/admin/unregistered-user-courses-accessibility", () => {
      let adminUser: UserWithCredentials;
      let adminCookies: string;

      beforeEach(async () => {
        await truncateTables(db, ["settings", "outbox_events"]);
        await globalSettingsFactory.create({ userId: null });

        adminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withAdminSettings(db)
          .create();

        await globalSettingsFactory.create();
        adminCookies = await cookieFor(adminUser, app);
      });

      afterEach(async () => {
        await truncateTables(db, ["settings", "outbox_events"]);
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
        await truncateTables(db, ["settings", "outbox_events"]);
        await globalSettingsFactory.create({ userId: null });

        adminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withAdminSettings(db)
          .create();

        adminCookies = await cookieFor(adminUser, app);
      });

      afterEach(async () => {
        await truncateTables(db, ["settings", "outbox_events"]);
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

    describe("PATCH /api/settings/admin/color-schema", () => {
      let adminUser: UserWithCredentials;
      let adminCookies: string;

      beforeEach(async () => {
        await truncateTables(db, ["settings", "outbox_events"]);
        await globalSettingsFactory.create({ userId: null });

        adminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withAdminSettings(db)
          .create();

        adminCookies = await cookieFor(adminUser, app);
      });

      afterEach(async () => {
        await truncateTables(db, ["settings", "outbox_events"]);
      });

      it("should update the global color schema setting (as Admin)", async () => {
        const primaryColor = "#123456";
        const contrastColor = "#654321";

        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/color-schema")
          .set("Cookie", adminCookies)
          .send({ primaryColor, contrastColor })
          .expect(200);

        expect(response.body.data.primaryColor).toBe(primaryColor);
        expect(response.body.data.contrastColor).toBe(contrastColor);

        const updatedGlobalSettings = await db.query.settings.findFirst({
          where: (s, { isNull }) => isNull(s.userId),
        });

        const globalSettings = updatedGlobalSettings?.settings as GlobalSettings;
        expect(globalSettings?.primaryColor).toBe(primaryColor);
        expect(globalSettings?.contrastColor).toBe(contrastColor);
      });

      it("should return 400 if invalid color format is provided", async () => {
        const invalidColor = "123456";
        const contrastColor = "#654321";

        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/color-schema")
          .set("Cookie", adminCookies)
          .send({ primaryColor: invalidColor, contrastColor })
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
          .patch("/api/settings/admin/color-schema")
          .set("Cookie", nonAdminCookies)
          .send({ primaryColor: "#123456", contrastColor: "#654321" })
          .expect(403);
      });

      it("should return 401 if not authenticated", async () => {
        await request(app.getHttpServer())
          .patch("/api/settings/admin/color-schema")
          .send({ primaryColor: "#123456", contrastColor: "#654321" })
          .expect(401);
      });
    });

    describe("Settings image asset endpoints", () => {
      let adminUser: UserWithCredentials;
      let adminCookies: string;

      beforeEach(async () => {
        await truncateTables(baseDb, ["settings", "outbox_events"]);
        await globalSettingsFactory.create({ userId: null });

        adminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withAdminSettings(db)
          .create();

        adminCookies = await cookieFor(adminUser, app);
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("should return versioned platform logo url when global key is configured", async () => {
        const fileKey = "platform-logos/logo.png";
        await db
          .update(settings)
          .set({
            settings: sql`
              jsonb_set(
                settings.settings,
                '{platformLogoS3Key}',
                to_jsonb(${fileKey}::text),
                true
              )
            `,
          })
          .where(isNull(settings.userId));

        const publicResponse = await request(app.getHttpServer())
          .get("/api/settings/platform-logo")
          .expect(200);

        expect(publicResponse.body.data.url).toBe(
          `/api/settings/platform-logo/image?v=${encodeURIComponent(fileKey)}`,
        );
      });

      it("should clear platform logo when PATCH is called without file", async () => {
        await db
          .update(settings)
          .set({
            settings: sql`
              jsonb_set(
                settings.settings,
                '{platformLogoS3Key}',
                to_jsonb(${"platform-logos/old-logo.png"}::text),
                true
              )
            `,
          })
          .where(isNull(settings.userId));

        await request(app.getHttpServer())
          .patch("/api/settings/platform-logo")
          .set("Cookie", adminCookies)
          .expect(200);

        const row = await db.query.settings.findFirst({ where: (s, { isNull }) => isNull(s.userId) });
        expect((row?.settings as GlobalSettings)?.platformLogoS3Key).toBeNull();
      });

      it("should return versioned platform simple logo url when global key is configured", async () => {
        const fileKey = "platform-simple-logos/logo-simple.png";
        await db
          .update(settings)
          .set({
            settings: sql`
              jsonb_set(
                settings.settings,
                '{platformSimpleLogoS3Key}',
                to_jsonb(${fileKey}::text),
                true
              )
            `,
          })
          .where(isNull(settings.userId));

        const response = await request(app.getHttpServer())
          .get("/api/settings/platform-simple-logo")
          .expect(200);

        expect(response.body.data.url).toBe(
          `/api/settings/platform-simple-logo/image?v=${encodeURIComponent(fileKey)}`,
        );
      });

      it("should reject non-admin upload attempts for settings images", async () => {
        const student = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();
        const studentCookies = await cookieFor(student, app);

        await request(app.getHttpServer())
          .patch("/api/settings/platform-logo")
          .set("Cookie", studentCookies)
          .attach("logo", validPngBuffer, { filename: "logo.png", contentType: "image/png" })
          .expect(403);

        await request(app.getHttpServer())
          .patch("/api/settings/certificate-background")
          .set("Cookie", studentCookies)
          .attach("certificate-background", validPngBuffer, {
            filename: "certificate.png",
            contentType: "image/png",
          })
          .expect(403);
      });

      it("should stream certificate background image with caching headers", async () => {
        const fileKey = "certificate-backgrounds/background.png";
        const etag = "\"certificate-etag\"";

        await db
          .update(settings)
          .set({
            settings: sql`
              jsonb_set(
                settings.settings,
                '{certificateBackgroundImage}',
                to_jsonb(${fileKey}::text),
                true
              )
            `,
          })
          .where(isNull(settings.userId));

        jest.spyOn(fileService, "getFileDelivery").mockResolvedValue({
          type: FILE_DELIVERY_TYPE.STREAM,
          stream: Readable.from(validPngBuffer),
          contentType: "image/png",
          contentLength: validPngBuffer.length,
          acceptRanges: "bytes",
          etag,
        });

        const response = await request(app.getHttpServer())
          .get("/api/settings/certificate-background/image")
          .expect(200);

        expect(response.headers["cache-control"]).toBe("public, max-age=86400");
        expect(response.headers["content-type"]).toContain("image/png");

        const cachedResponse = await request(app.getHttpServer())
          .get("/api/settings/certificate-background/image")
          .set("If-None-Match", etag)
          .expect(304);

        expect(cachedResponse.headers.etag).toBe(etag);
      });

      it("should return 404 when certificate background image is not configured", async () => {
        await request(app.getHttpServer()).get("/api/settings/certificate-background/image").expect(404);
      });
    });
  });
});
