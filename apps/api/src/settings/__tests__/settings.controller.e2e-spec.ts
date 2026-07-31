import { DASHBOARD_WIDGET_IDS, DASHBOARD_WIDGET_WIDTHS } from "@repo/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { chapters, settings } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
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
  let defaultTenantId: string;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  const testPassword = "Password123@@";

  beforeAll(async () => {
    const { app: testApp, defaultTenantId: testTenantId } = await createE2ETest();
    app = testApp;
    defaultTenantId = testTenantId;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("User Settings", () => {
    let testUser: UserWithCredentials;
    let testCookies: string;

    describe("PUT /api/settings", () => {
      beforeEach(async () => {
        await truncateTables(baseDb, ["settings"]);
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

      it("should update a valid dashboard layout", async () => {
        const dashboard = {
          widgets: [
            {
              id: DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING,
              order: 0,
              width: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
            },
          ],
        };

        const response = await request(app.getHttpServer())
          .put("/api/settings")
          .set("Cookie", testCookies)
          .send({ dashboard })
          .expect(200);

        expect(response.body.data.dashboard).toEqual(dashboard);
      });

      it("should return 400 if a widget uses a width that its definition does not allow", async () => {
        await request(app.getHttpServer())
          .put("/api/settings")
          .set("Cookie", testCookies)
          .send({
            dashboard: {
              widgets: [
                {
                  id: DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING,
                  order: 0,
                  width: DASHBOARD_WIDGET_WIDTHS.SMALL,
                },
              ],
            },
          })
          .expect(400);
      });

      it("should return 400 if dashboard settings contain an unknown widget or width", async () => {
        await request(app.getHttpServer())
          .put("/api/settings")
          .set("Cookie", testCookies)
          .send({
            dashboard: {
              widgets: [{ id: "unknown", order: 0, width: 3 }],
            },
          })
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
        await truncateTables(baseDb, ["settings"]);
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
        expect(response.body.data.dashboard).toEqual({
          widgets: [
            {
              id: DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING,
              order: 1,
              width: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
            },
            {
              id: DASHBOARD_WIDGET_IDS.STUDENT_REQUIRED_COURSE,
              order: 2,
              width: DASHBOARD_WIDGET_WIDTHS.SMALL,
            },
            {
              id: DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION,
              order: 3,
              width: DASHBOARD_WIDGET_WIDTHS.SMALL,
            },
          ],
        });
      });
    });

    describe("dashboard widget catalog", () => {
      beforeEach(async () => {
        await truncateTables(baseDb, ["settings"]);
        await globalSettingsFactory.create({ userId: null });

        testUser = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();

        testCookies = await cookieFor(testUser, app);
      });

      it("should return dashboard widgets available to the current user", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/settings/dashboard")
          .set("Cookie", testCookies)
          .expect(200);

        expect(response.body.data).toEqual([
          DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING,
          DASHBOARD_WIDGET_IDS.STUDENT_REQUIRED_COURSE,
          DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION,
          DASHBOARD_WIDGET_IDS.STUDENT_CERTIFICATES,
        ]);
      });

      it("should return the role-aware default dashboard layout", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/settings/dashboard/default")
          .set("Cookie", testCookies)
          .expect(200);

        expect(response.body.data).toEqual([
          {
            id: DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING,
            order: 1,
            width: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
          },
          {
            id: DASHBOARD_WIDGET_IDS.STUDENT_REQUIRED_COURSE,
            order: 2,
            width: DASHBOARD_WIDGET_WIDTHS.SMALL,
          },
          {
            id: DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION,
            order: 3,
            width: DASHBOARD_WIDGET_WIDTHS.SMALL,
          },
        ]);
      });

      it.each(["/api/settings/dashboard", "/api/settings/dashboard/default"])(
        "should return 401 for unauthenticated requests to %s",
        async (endpoint) => {
          await request(app.getHttpServer()).get(endpoint).expect(401);
        },
      );
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
        expect(response.body.data.learningPathsEnabled).toBe(true);
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
          `/api/settings/certificate-background/image?v=${encodeURIComponent(
            certificateBackgroundKey,
          )}`,
        );
      });
    });

    describe("GET /api/settings/manifest.webmanifest", () => {
      it("should return a tenant-specific public PWA manifest", async () => {
        const simpleLogoKey = "platform-simple-logos/variants/simple.webp";

        await baseDb
          .update(settings)
          .set({
            settings: sql`${settings.settings} || ${settingsToJSONBuildObject({
              companyInformation: {
                companyName: "Acme Learning",
                companyShortName: "Acme",
              },
              primaryColor: "#123456",
              contrastColor: "#fefefe",
              platformSimpleLogoS3Key: simpleLogoKey,
            })}::jsonb`,
          })
          .where(and(eq(settings.tenantId, defaultTenantId), isNull(settings.userId)));

        const response = await request(app.getHttpServer())
          .get("/api/settings/manifest.webmanifest")
          .expect("Content-Type", /application\/manifest\+json/)
          .expect("Cache-Control", "no-store")
          .expect(200);

        expect(response.body).toEqual({
          name: "Acme LMS",
          short_name: "Acme LMS",
          theme_color: "#123456",
          background_color: "#fefefe",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: `/api/settings/platform-simple-logo/image?v=${encodeURIComponent(
                simpleLogoKey,
              )}&quality=192w`,
              sizes: "192x192",
              type: "image/webp",
            },
            {
              src: `/api/settings/platform-simple-logo/image?v=${encodeURIComponent(
                simpleLogoKey,
              )}&quality=512w`,
              sizes: "512x512",
              type: "image/webp",
            },
          ],
        });
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
        await truncateTables(baseDb, ["courses", "chapters", "users", "categories", "settings"]);
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

      it("should disable public chapter toggles for free courses when visitor course access is disabled", async () => {
        await db
          .update(settings)
          .set({
            settings: sql`
              jsonb_set(
                ${settings.settings},
                '{unregisteredUserCoursesAccessibility}',
                'true'::jsonb,
                true
              )
            `,
          })
          .where(isNull(settings.userId));

        const freeCourse = await courseFactory.create({
          authorId: adminUser.id,
          priceInCents: 0,
          chapterCount: 1,
        });
        const paidCourse = await courseFactory.create({
          authorId: adminUser.id,
          priceInCents: 1200,
          chapterCount: 1,
        });
        const publicChapter = await chapterFactory.create({
          authorId: adminUser.id,
          courseId: freeCourse.id,
          isFreemium: true,
        });
        const paidFreemiumChapter = await chapterFactory.create({
          authorId: adminUser.id,
          courseId: paidCourse.id,
          isFreemium: true,
        });

        await request(app.getHttpServer())
          .patch("/api/settings/admin/unregistered-user-courses-accessibility")
          .set("Cookie", adminCookies)
          .expect(200);

        const [updatedPublicChapter] = await db
          .select({ isFreemium: chapters.isFreemium })
          .from(chapters)
          .where(eq(chapters.id, publicChapter.id));
        const [updatedPaidFreemiumChapter] = await db
          .select({ isFreemium: chapters.isFreemium })
          .from(chapters)
          .where(eq(chapters.id, paidFreemiumChapter.id));

        expect(updatedPublicChapter.isFreemium).toBe(false);
        expect(updatedPaidFreemiumChapter.isFreemium).toBe(true);
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

    describe("PATCH /api/settings/admin/learning-paths-enabled", () => {
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

      it("should toggle the global learning paths enabled setting (as Admin)", async () => {
        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/learning-paths-enabled")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.learningPathsEnabled).toBe(false);

        const toggleResponse = await request(app.getHttpServer())
          .patch("/api/settings/admin/learning-paths-enabled")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(toggleResponse.body.data.learningPathsEnabled).toBe(true);
      });

      it("should return 403 if user is not an admin", async () => {
        const nonAdminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();

        const nonAdminCookies = await cookieFor(nonAdminUser, app);

        await request(app.getHttpServer())
          .patch("/api/settings/admin/learning-paths-enabled")
          .set("Cookie", nonAdminCookies)
          .expect(403);
      });

      it("should return 401 if not authenticated", async () => {
        await request(app.getHttpServer())
          .patch("/api/settings/admin/learning-paths-enabled")
          .expect(401);
      });
    });

    describe("PATCH /api/settings/admin/course-discussions", () => {
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

      it("should toggle the global course discussions setting as admin", async () => {
        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/course-discussions")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.courseDiscussionsEnabled).toBe(true);

        const toggleResponse = await request(app.getHttpServer())
          .patch("/api/settings/admin/course-discussions")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(toggleResponse.body.data.courseDiscussionsEnabled).toBe(false);
      });

      it("should return 403 if user is not an admin", async () => {
        const nonAdminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();

        const nonAdminCookies = await cookieFor(nonAdminUser, app);

        await request(app.getHttpServer())
          .patch("/api/settings/admin/course-discussions")
          .set("Cookie", nonAdminCookies)
          .expect(403);
      });

      it("should return 401 if not authenticated", async () => {
        await request(app.getHttpServer())
          .patch("/api/settings/admin/course-discussions")
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

    describe("PATCH /api/settings/admin/calendar", () => {
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

      it("should keep the global calendar setting enabled as admin", async () => {
        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/calendar")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.calendarEnabled).toBe(true);
        expect(response.body.data.liveTrainingEnabled).toBe(false);

        const toggleResponse = await request(app.getHttpServer())
          .patch("/api/settings/admin/calendar")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(toggleResponse.body.data.calendarEnabled).toBe(true);
        expect(toggleResponse.body.data.liveTrainingEnabled).toBe(false);
      });

      it("should return 403 if user is not an admin", async () => {
        const nonAdminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();

        const nonAdminCookies = await cookieFor(nonAdminUser, app);

        await request(app.getHttpServer())
          .patch("/api/settings/admin/calendar")
          .set("Cookie", nonAdminCookies)
          .expect(403);
      });

      it("should return 401 if not authenticated", async () => {
        await request(app.getHttpServer()).patch("/api/settings/admin/calendar").expect(401);
      });
    });

    describe("PATCH /api/settings/admin/live-training", () => {
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

      it("should toggle live training while calendar stays enabled", async () => {
        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/live-training")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.liveTrainingEnabled).toBe(true);
        expect(response.body.data.calendarEnabled).toBe(true);

        const toggleResponse = await request(app.getHttpServer())
          .patch("/api/settings/admin/live-training")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(toggleResponse.body.data.liveTrainingEnabled).toBe(false);
        expect(toggleResponse.body.data.calendarEnabled).toBe(true);
      });

      it("should not disable live training when calendar endpoint is called", async () => {
        await request(app.getHttpServer())
          .patch("/api/settings/admin/live-training")
          .set("Cookie", adminCookies)
          .expect(200);

        const response = await request(app.getHttpServer())
          .patch("/api/settings/admin/calendar")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.calendarEnabled).toBe(true);
        expect(response.body.data.liveTrainingEnabled).toBe(true);
      });

      it("should return 403 if user is not an admin", async () => {
        const nonAdminUser = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create();

        const nonAdminCookies = await cookieFor(nonAdminUser, app);

        await request(app.getHttpServer())
          .patch("/api/settings/admin/live-training")
          .set("Cookie", nonAdminCookies)
          .expect(403);
      });

      it("should return 401 if not authenticated", async () => {
        await request(app.getHttpServer()).patch("/api/settings/admin/live-training").expect(401);
      });
    });

    describe("PATCH /api/settings/admin/color-schema", () => {
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
  });
});
