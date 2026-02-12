import { faker } from "@faker-js/faker";
import { eq, isNull } from "drizzle-orm";
import request from "supertest";

import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { questionsAndAnswers, settings } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createQAFactory } from "../../../test/factory/qa.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("QAController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let qaFactory: ReturnType<typeof createQAFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  const password = "Password123!";

  const seedGlobalSettings = async (overrides: Partial<typeof DEFAULT_GLOBAL_SETTINGS> = {}) => {
    await settingsFactory.create();
    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_GLOBAL_SETTINGS,
          ...overrides,
        }),
      })
      .where(isNull(settings.userId));
  };

  const createAdminWithCookie = async () => {
    const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();
    return { admin, cookie: await cookieFor(admin, app) };
  };

  const createStudentWithCookie = async () => {
    const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();
    return { student, cookie: await cookieFor(student, app) };
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);

    qaFactory = createQAFactory(db);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(db, [
      "activity_logs",
      "questions_and_answers",
      "settings",
      "credentials",
      "user_onboarding",
      "users",
    ]);
  });

  describe("GET /api/qa", () => {
    it("returns QA list for authenticated user when QA is enabled", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create({ baseLanguage: "en", availableLocales: ["en"] });

      const response = await request(app.getHttpServer())
        .get("/api/qa?language=en")
        .set("Cookie", cookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(qa.id);
    });

    it("returns QA list for unauthenticated user when guest access is allowed", async () => {
      await seedGlobalSettings({ QAEnabled: true, unregisteredUserQAAccessibility: true });
      const qa = await qaFactory.create();

      const response = await request(app.getHttpServer()).get("/api/qa?language=en").expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(qa.id);
    });

    it("returns 400 when QA is disabled", async () => {
      await seedGlobalSettings({ QAEnabled: false });
      const { cookie } = await createAdminWithCookie();
      await qaFactory.create();

      const response = await request(app.getHttpServer())
        .get("/api/qa?language=en")
        .set("Cookie", cookie)
        .expect(400);

      expect(response.body.message).toBe("common.toast.noAccess");
    });

    it("returns 400 for guests when guest access is disabled", async () => {
      await seedGlobalSettings({ QAEnabled: true, unregisteredUserQAAccessibility: false });
      await qaFactory.create();

      const response = await request(app.getHttpServer()).get("/api/qa?language=en").expect(400);

      expect(response.body.message).toBe("common.toast.noAccess");
    });
  });

  describe("GET /api/qa/:qaId", () => {
    it("returns QA in requested language for admin", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create({ baseLanguage: "en", availableLocales: ["en"] });

      const response = await request(app.getHttpServer())
        .get(`/api/qa/${qa.id}?language=en`)
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.id).toBe(qa.id);
      expect(response.body.baseLanguage).toBe("en");
    });

    it("returns 401 when user is not authenticated", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const qa = await qaFactory.create();

      await request(app.getHttpServer()).get(`/api/qa/${qa.id}?language=en`).expect(401);
    });
  });

  describe("POST /api/qa", () => {
    it("creates QA for admin", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();

      const payload = { title: "Question", description: "Answer", language: "en" };

      await request(app.getHttpServer())
        .post("/api/qa")
        .set("Cookie", cookie)
        .send(payload)
        .expect(201);

      const [created] = await db
        .select()
        .from(questionsAndAnswers)
        .where(eq(questionsAndAnswers.baseLanguage, "en"));

      expect(created).toBeDefined();
      expect(created.availableLocales).toContain("en");
    });

    it("returns 403 for non-admin users", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createStudentWithCookie();

      const payload = { title: "Question", description: "Answer", language: "en" };

      await request(app.getHttpServer())
        .post("/api/qa")
        .set("Cookie", cookie)
        .send(payload)
        .expect(403);
    });

    it("returns 400 when body is invalid", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();

      await request(app.getHttpServer())
        .post("/api/qa")
        .set("Cookie", cookie)
        // missing description
        .send({ title: "Only title" })
        .expect(400);
    });
  });

  describe("POST /api/qa/create-language/:qaId", () => {
    it("adds a new language for QA", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create({ baseLanguage: "en", availableLocales: ["en"] });

      const response = await request(app.getHttpServer())
        .post(`/api/qa/create-language/${qa.id}?language=pl`)
        .set("Cookie", cookie)
        .expect(201);

      expect(response.body.availableLocales).toEqual(expect.arrayContaining(["en", "pl"]));
    });

    it("returns 400 if language already exists", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create({ baseLanguage: "en", availableLocales: ["en"] });

      const response = await request(app.getHttpServer())
        .post(`/api/qa/create-language/${qa.id}?language=en`)
        .set("Cookie", cookie)
        .expect(400);

      expect(response.body.message).toBe("qaView.toast.languageAlreadyExists");
    });

    it("returns 404 when QA does not exist", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const randomId = faker.string.uuid();

      await request(app.getHttpServer())
        .post(`/api/qa/create-language/${randomId}?language=pl`)
        .set("Cookie", cookie)
        .expect(404);
    });
  });

  describe("PATCH /api/qa/:qaId", () => {
    it("updates QA for given language", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create({ baseLanguage: "en", availableLocales: ["en", "pl"] });

      const response = await request(app.getHttpServer())
        .patch(`/api/qa/${qa.id}?language=en`)
        .set("Cookie", cookie)
        .send({ title: "Updated title" })
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it("returns 400 when no data to update", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create({ baseLanguage: "en", availableLocales: ["en"] });

      const response = await request(app.getHttpServer())
        .patch(`/api/qa/${qa.id}?language=en`)
        .set("Cookie", cookie)
        .send({})
        .expect(400);

      expect(response.body.message).toBe("qaView.toast.noDataToUpdate");
    });

    it("returns 400 when language is not supported", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create({ baseLanguage: "en", availableLocales: ["en"] });

      const response = await request(app.getHttpServer())
        .patch(`/api/qa/${qa.id}?language=pl`)
        .set("Cookie", cookie)
        .send({ title: "Will fail" })
        .expect(400);

      expect(response.body.message).toBe("qaView.toast.languageNotSupported");
    });
  });

  describe("DELETE /api/qa/:qaId", () => {
    it("deletes QA", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create();

      await request(app.getHttpServer())
        .delete(`/api/qa/${qa.id}`)
        .set("Cookie", cookie)
        .expect(200);

      const [deleted] = await db
        .select()
        .from(questionsAndAnswers)
        .where(eq(questionsAndAnswers.id, qa.id));

      expect(deleted).toBeUndefined();
    });
  });

  describe("DELETE /api/qa/language/:qaId", () => {
    it("removes a non-base language", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create({
        baseLanguage: "en",
        availableLocales: ["en", "pl"],
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/qa/language/${qa.id}?language=pl`)
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.availableLocales).toEqual(["en"]);
    });

    it("returns 400 when trying to remove base language", async () => {
      await seedGlobalSettings({ QAEnabled: true });
      const { cookie } = await createAdminWithCookie();
      const qa = await qaFactory.create({ baseLanguage: "en", availableLocales: ["en", "pl"] });

      const response = await request(app.getHttpServer())
        .delete(`/api/qa/language/${qa.id}?language=en`)
        .set("Cookie", cookie)
        .expect(400);

      expect(response.body.message).toBe("qaView.toast.cannotDeleteLanguage");
    });
  });
});
