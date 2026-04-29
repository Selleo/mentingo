import {
  ALLOWED_ARTICLES_SETTINGS,
  ALLOWED_NEWS_SETTINGS,
  ALLOWED_QA_SETTINGS,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { isNull } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { settings } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { DatabasePg } from "src/common";
import type { INestApplication } from "@nestjs/common";

type RuntimeGlobalSettings = {
  [key: string]: any;
  userEmailTriggers: {
    [key: string]: boolean;
    userFirstLogin: boolean;
  };
};

type RuntimeAdminSettings = {
  [key: string]: any;
};

describe("SettingsController - additional admin coverage (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;

  const testPassword = "Password123@@";

  const createAdminWithCookie = async () => {
    const admin = await userFactory.withCredentials({ password: testPassword }).withAdminSettings(db).create({
      role: SYSTEM_ROLE_SLUGS.ADMIN,
    });
    const cookie = await cookieFor(admin, app);
    return { admin, cookie };
  };

  const createStudentWithCookie = async () => {
    const student = await userFactory
      .withCredentials({ password: testPassword })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const cookie = await cookieFor(student, app);
    return { student, cookie };
  };

  const getGlobalSettings = async (): Promise<RuntimeGlobalSettings> => {
    const row = await db.query.settings.findFirst({ where: (s, { isNull }) => isNull(s.userId) });
    return row?.settings as RuntimeGlobalSettings;
  };

  const getUserSettings = async (userId: string): Promise<RuntimeAdminSettings> => {
    const row = await db.query.settings.findFirst({ where: (s, { eq }) => eq(s.userId, userId) });
    return row?.settings as RuntimeAdminSettings;
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);
  });

  beforeEach(async () => {
    await truncateTables(baseDb, [
      "outbox_events",
      "form_field_answers",
      "form_fields",
      "forms",
      "settings",
      "credentials",
      "user_onboarding",
      "users",
    ]);
    await globalSettingsFactory.create({ userId: null });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("global toggle endpoints", () => {
    it("PATCH /api/settings/admin/modern-course-list toggles persisted global setting", async () => {
      const { cookie } = await createAdminWithCookie();
      const initial = (await getGlobalSettings()).modernCourseListEnabled;

      const response = await request(app.getHttpServer())
        .patch("/api/settings/admin/modern-course-list")
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.data.modernCourseListEnabled).toBe(!initial);
      expect((await getGlobalSettings()).modernCourseListEnabled).toBe(!initial);
    });

    it("PATCH /api/settings/admin/invite-only-registration toggles persisted global setting", async () => {
      const { cookie } = await createAdminWithCookie();
      const initial = (await getGlobalSettings()).inviteOnlyRegistration;

      const response = await request(app.getHttpServer())
        .patch("/api/settings/admin/invite-only-registration")
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.data.inviteOnlyRegistration).toBe(!initial);
      expect((await getGlobalSettings()).inviteOnlyRegistration).toBe(!initial);
    });

    it("PATCH /api/settings/admin/default-course-currency updates persisted currency", async () => {
      const { cookie } = await createAdminWithCookie();

      const response = await request(app.getHttpServer())
        .patch("/api/settings/admin/default-course-currency")
        .set("Cookie", cookie)
        .send({ defaultCourseCurrency: "eur" })
        .expect(200);

      expect(response.body.data.defaultCourseCurrency).toBe("eur");
      expect((await getGlobalSettings()).defaultCourseCurrency).toBe("eur");
    });

    it("PATCH /api/settings/admin/default-course-currency rejects unsupported currency", async () => {
      const { cookie } = await createAdminWithCookie();

      await request(app.getHttpServer())
        .patch("/api/settings/admin/default-course-currency")
        .set("Cookie", cookie)
        .send({ defaultCourseCurrency: "jpy" })
        .expect(400);
    });

    it("PATCH /api/settings/admin/age-limit sets numeric limit and null", async () => {
      const { cookie } = await createAdminWithCookie();

      const setLimit = await request(app.getHttpServer())
        .patch("/api/settings/admin/age-limit")
        .set("Cookie", cookie)
        .send({ ageLimit: 13 })
        .expect(200);

      expect(setLimit.body.data.ageLimit).toBe(13);
      expect((await getGlobalSettings()).ageLimit).toBe(13);

      const clearLimit = await request(app.getHttpServer())
        .patch("/api/settings/admin/age-limit")
        .set("Cookie", cookie)
        .send({ ageLimit: null })
        .expect(200);

      expect(clearLimit.body.data.ageLimit).toBeNull();
      expect((await getGlobalSettings()).ageLimit).toBeNull();
    });

    it("PATCH /api/settings/admin/age-limit rejects unsupported value", async () => {
      const { cookie } = await createAdminWithCookie();

      await request(app.getHttpServer())
        .patch("/api/settings/admin/age-limit")
        .set("Cookie", cookie)
        .send({ ageLimit: 18 })
        .expect(400);
    });
  });

  describe("admin user settings toggles", () => {
    it("PATCH /api/settings/admin/finished-course-notification toggles admin setting", async () => {
      const { admin, cookie } = await createAdminWithCookie();
      const initial = (await getUserSettings(admin.id)).adminFinishedCourseNotification;

      await request(app.getHttpServer())
        .patch("/api/settings/admin/finished-course-notification")
        .set("Cookie", cookie)
        .expect(200);

      expect((await getUserSettings(admin.id)).adminFinishedCourseNotification).toBe(!initial);
    });

    it("PATCH /api/settings/admin/overdue-course-notification toggles admin setting", async () => {
      const { admin, cookie } = await createAdminWithCookie();
      const initial = (await getUserSettings(admin.id)).adminOverdueCourseNotification;

      await request(app.getHttpServer())
        .patch("/api/settings/admin/overdue-course-notification")
        .set("Cookie", cookie)
        .expect(200);

      expect((await getUserSettings(admin.id)).adminOverdueCourseNotification).toBe(!initial);
    });

    it("PATCH /api/settings/admin/config-warning-dismissed persists provided boolean", async () => {
      const { admin, cookie } = await createAdminWithCookie();

      const response = await request(app.getHttpServer())
        .patch("/api/settings/admin/config-warning-dismissed")
        .set("Cookie", cookie)
        .send({ dismissed: true })
        .expect(200);

      expect(response.body.data.configWarningDismissed).toBe(true);
      expect((await getUserSettings(admin.id)).configWarningDismissed).toBe(true);
    });
  });

  describe("MFA and email trigger settings", () => {
    it("PATCH /api/settings/admin/mfa-enforced-roles stores only roles with true value", async () => {
      const { cookie } = await createAdminWithCookie();

      const response = await request(app.getHttpServer())
        .patch("/api/settings/admin/mfa-enforced-roles")
        .set("Cookie", cookie)
        .send({
          admin: true,
          student: false,
          content_creator: true,
        })
        .expect(200);

      const responseRoles = Array.isArray(response.body.MFAEnforcedRoles)
        ? response.body.MFAEnforcedRoles
        : JSON.parse(response.body.MFAEnforcedRoles ?? "[]");
      const storedRoles = Array.isArray((await getGlobalSettings()).MFAEnforcedRoles)
        ? (await getGlobalSettings()).MFAEnforcedRoles
        : JSON.parse((await getGlobalSettings()).MFAEnforcedRoles ?? "[]");

      expect(responseRoles).toEqual(expect.arrayContaining(["admin", "content_creator"]));
      expect(responseRoles).not.toContain("student");
      expect(storedRoles).toEqual(expect.arrayContaining(["admin", "content_creator"]));
    });

    it("PATCH /api/settings/admin/user-email-triggers/:triggerKey toggles trigger", async () => {
      const { cookie } = await createAdminWithCookie();
      const initial = (await getGlobalSettings()).userEmailTriggers.userFirstLogin;

      const response = await request(app.getHttpServer())
        .patch("/api/settings/admin/user-email-triggers/userFirstLogin")
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.data.userEmailTriggers.userFirstLogin).toBe(!initial);
      expect((await getGlobalSettings()).userEmailTriggers.userFirstLogin).toBe(!initial);
    });

    it("PATCH /api/settings/admin/user-email-triggers/:triggerKey returns 400 for invalid key", async () => {
      const { cookie } = await createAdminWithCookie();

      const response = await request(app.getHttpServer())
        .patch("/api/settings/admin/user-email-triggers/notARealTrigger")
        .set("Cookie", cookie)
        .expect(400);

      expect(response.body.message).toBe("Invalid trigger key");
    });
  });

  describe("QA/news/articles feature toggles", () => {
    it("QA settings: blocks sub-setting while disabled, then allows after enabling", async () => {
      const { cookie } = await createAdminWithCookie();

      const blocked = await request(app.getHttpServer())
        .patch(`/api/settings/admin/qa/${ALLOWED_QA_SETTINGS.UNREGISTERED_USER_QA_ACCESSIBILITY}`)
        .set("Cookie", cookie)
        .expect(400);

      expect(blocked.body.message).toBe("qaPreferences.toast.QANotEnabled");

      await request(app.getHttpServer())
        .patch(`/api/settings/admin/qa/${ALLOWED_QA_SETTINGS.QA_ENABLED}`)
        .set("Cookie", cookie)
        .expect(200);

      const allowed = await request(app.getHttpServer())
        .patch(`/api/settings/admin/qa/${ALLOWED_QA_SETTINGS.UNREGISTERED_USER_QA_ACCESSIBILITY}`)
        .set("Cookie", cookie)
        .expect(200);

      expect(allowed.body.data.QAEnabled).toBe(true);
      expect(allowed.body.data.unregisteredUserQAAccessibility).toBe(true);
    });

    it("News settings: blocks sub-setting while disabled, then allows after enabling", async () => {
      const { cookie } = await createAdminWithCookie();

      const blocked = await request(app.getHttpServer())
        .patch(
          `/api/settings/admin/news/${ALLOWED_NEWS_SETTINGS.UNREGISTERED_USER_NEWS_ACCESSIBILITY}`,
        )
        .set("Cookie", cookie)
        .expect(400);

      expect(blocked.body.message).toBe("newsPreferences.toast.newsNotEnabled");

      await request(app.getHttpServer())
        .patch(`/api/settings/admin/news/${ALLOWED_NEWS_SETTINGS.NEWS_ENABLED}`)
        .set("Cookie", cookie)
        .expect(200);

      const allowed = await request(app.getHttpServer())
        .patch(
          `/api/settings/admin/news/${ALLOWED_NEWS_SETTINGS.UNREGISTERED_USER_NEWS_ACCESSIBILITY}`,
        )
        .set("Cookie", cookie)
        .expect(200);

      expect(allowed.body.data.newsEnabled).toBe(true);
      expect(allowed.body.data.unregisteredUserNewsAccessibility).toBe(true);
    });

    it("Articles settings: blocks sub-setting while disabled, then allows after enabling", async () => {
      const { cookie } = await createAdminWithCookie();

      const blocked = await request(app.getHttpServer())
        .patch(
          `/api/settings/admin/articles/${ALLOWED_ARTICLES_SETTINGS.UNREGISTERED_USER_ARTICLES_ACCESSIBILITY}`,
        )
        .set("Cookie", cookie)
        .expect(400);

      expect(blocked.body.message).toBe("articlesPreferences.toast.articlesNotEnabled");

      await request(app.getHttpServer())
        .patch(`/api/settings/admin/articles/${ALLOWED_ARTICLES_SETTINGS.ARTICLES_ENABLED}`)
        .set("Cookie", cookie)
        .expect(200);

      const allowed = await request(app.getHttpServer())
        .patch(
          `/api/settings/admin/articles/${ALLOWED_ARTICLES_SETTINGS.UNREGISTERED_USER_ARTICLES_ACCESSIBILITY}`,
        )
        .set("Cookie", cookie)
        .expect(200);

      expect(allowed.body.data.articlesEnabled).toBe(true);
      expect(allowed.body.data.unregisteredUserArticlesAccessibility).toBe(true);
    });

    it("admin routes remain protected for non-admin users", async () => {
      const { cookie } = await createStudentWithCookie();

      await request(app.getHttpServer())
        .patch(`/api/settings/admin/qa/${ALLOWED_QA_SETTINGS.QA_ENABLED}`)
        .set("Cookie", cookie)
        .expect(403);
    });
  });

  describe("registration form endpoints", () => {
    it("creates registration fields via admin endpoint and serves localized public form", async () => {
      const { cookie } = await createAdminWithCookie();

      const updateResponse = await request(app.getHttpServer())
        .patch("/api/settings/admin/registration-form")
        .set("Cookie", cookie)
        .send({
          fields: [
            {
              type: "checkbox",
              label: {
                en: "Accept terms",
                pl: "Akceptuj regulamin",
              },
              baseLanguage: "en",
              availableLocales: ["en", "pl"],
              required: true,
              displayOrder: 0,
              archived: false,
            },
          ],
        })
        .expect(200);

      expect(updateResponse.body.data.fields).toHaveLength(1);
      expect(updateResponse.body.data.fields[0].label).toEqual({
        en: "Accept terms",
        pl: "Akceptuj regulamin",
      });

      const publicPl = await request(app.getHttpServer())
        .get("/api/settings/registration-form?language=pl")
        .expect(200);

      expect(publicPl.body.data.fields).toHaveLength(1);
      expect(publicPl.body.data.fields[0].label).toBe("Akceptuj regulamin");

      const fieldId = updateResponse.body.data.fields[0].id;

      await request(app.getHttpServer())
        .patch("/api/settings/admin/registration-form")
        .set("Cookie", cookie)
        .send({
          fields: [
            {
              id: fieldId,
              type: "checkbox",
              label: {
                en: "Accept terms",
                pl: "Akceptuj regulamin",
              },
              baseLanguage: "en",
              availableLocales: ["en", "pl"],
              required: true,
              displayOrder: 0,
              archived: true,
            },
          ],
        })
        .expect(200);

      const publicAfterArchive = await request(app.getHttpServer())
        .get("/api/settings/registration-form?language=en")
        .expect(200);

      expect(publicAfterArchive.body.data.fields).toEqual([]);

      const adminView = await request(app.getHttpServer())
        .get("/api/settings/admin/registration-form")
        .set("Cookie", cookie)
        .expect(200);

      expect(adminView.body.data.fields).toHaveLength(1);
      expect(adminView.body.data.fields[0].archived).toBe(true);
    });

    it("requires admin permissions for registration form admin endpoints", async () => {
      const { cookie } = await createStudentWithCookie();

      await request(app.getHttpServer())
        .get("/api/settings/admin/registration-form")
        .set("Cookie", cookie)
        .expect(403);

      await request(app.getHttpServer())
        .patch("/api/settings/admin/registration-form")
        .set("Cookie", cookie)
        .send({ fields: [] })
        .expect(403);
    });
  });

  describe("auth checks for additional admin endpoints", () => {
    it("returns 401 for unauthenticated request", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/admin/modern-course-list")
        .expect(401);
    });

    it("keeps global settings record available", async () => {
      const row = await db.query.settings.findFirst({ where: (s, { isNull }) => isNull(s.userId) });
      expect(row).toBeDefined();
      expect(row?.settings).toBeDefined();
    });
  });
});
