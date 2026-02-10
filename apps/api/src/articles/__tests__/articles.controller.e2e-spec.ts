import { isNull } from "drizzle-orm";
import request from "supertest";

import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { settings } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  createArticleFactory,
  createArticleSectionFactory,
} from "../../../test/factory/article.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("ArticlesController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let articleFactory: ReturnType<typeof createArticleFactory>;
  let sectionFactory: ReturnType<typeof createArticleSectionFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  const password = "Password123!";

  const createAdmin = async () => {
    return userFactory.withCredentials({ password }).withAdminSettings(db).create({
      role: USER_ROLES.ADMIN,
    });
  };

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

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    articleFactory = createArticleFactory(db);
    sectionFactory = createArticleSectionFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  beforeEach(async () => {
    await seedGlobalSettings({
      articlesEnabled: true,
      unregisteredUserArticlesAccessibility: true,
    });
  });

  afterEach(async () => {
    await truncateTables(baseDb, [
      "articles",
      "article_sections",
      "settings",
      "credentials",
      "user_onboarding",
      "users",
    ]);
  });

  describe("GET /api/articles", () => {
    it("returns only public published articles", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Public" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Public article",
        isPublic: true,
      });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Private article",
        isPublic: false,
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles?language=en")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe("Public article");
    });

    it("returns private articles for authenticated admin", async () => {
      const admin = await createAdmin();
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Admin view" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Public article",
        isPublic: true,
      });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Private article",
        isPublic: false,
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles?language=en")
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body).toHaveLength(2);
      const titles = response.body.map((article: { title: string }) => article.title);
      expect(titles).toEqual(expect.arrayContaining(["Public article", "Private article"]));
    });
  });

  describe("GET /api/articles/:id", () => {
    it("returns 404 for draft article without draft mode", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Draft" });
      const draft = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        status: "draft",
      });

      await request(app.getHttpServer()).get(`/api/articles/${draft.id}?language=en`).expect(404);
    });
  });

  describe("GET /api/articles/drafts", () => {
    it("requires authentication", async () => {
      await request(app.getHttpServer()).get("/api/articles/drafts?language=en").expect(401);
    });

    it("returns draft articles for admin", async () => {
      const admin = await createAdmin();
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Draft section" });

      const draft = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        status: "draft",
        title: "Draft article",
      });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        status: "published",
        title: "Published article",
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles/drafts?language=en")
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(draft.id);
    });
  });

  describe("POST /api/articles/section", () => {
    it("creates section for admin", async () => {
      const admin = await createAdmin();

      const cookie = await cookieFor(admin, app);

      const response = await request(app.getHttpServer())
        .post("/api/articles/section")
        .set("Cookie", cookie)
        .send({ language: "en" })
        .expect(201);

      expect(response.body.data.id).toBeDefined();
    });

    it("rejects non-admin", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });

      await request(app.getHttpServer())
        .post("/api/articles/section")
        .set("Cookie", await cookieFor(user, app))
        .send({ language: "en" })
        .expect(403);
    });
  });

  describe("GET /api/articles/section/:id", () => {
    it("requires authentication", async () => {
      const section = await sectionFactory.create({ title: "Restricted" });

      await request(app.getHttpServer())
        .get(`/api/articles/section/${section.id}?language=en`)
        .expect(401);
    });

    it("returns section details for admin", async () => {
      const admin = await createAdmin();
      const section = await sectionFactory.create({ title: "Details" });

      const response = await request(app.getHttpServer())
        .get(`/api/articles/section/${section.id}?language=en`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data.id).toBe(section.id);
      expect(response.body.data.title).toBe("Details");
      expect(response.body.data.assignedArticlesCount).toBe(0);
    });
  });

  describe("PATCH /api/articles/section/:id", () => {
    it("updates section title for admin", async () => {
      const admin = await createAdmin();
      const section = await sectionFactory.create({ title: "Old title" });

      const response = await request(app.getHttpServer())
        .patch(`/api/articles/section/${section.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "en", title: "New title" })
        .expect(200);

      expect(response.body.data.id).toBe(section.id);
      expect(response.body.data.title).toBe("New title");
    });
  });

  describe("POST /api/articles/section/:id/language", () => {
    it("adds and removes language for section", async () => {
      const admin = await createAdmin();
      const section = await sectionFactory.create({ title: "Localized" });
      const cookie = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post(`/api/articles/section/${section.id}/language`)
        .set("Cookie", cookie)
        .send({ language: "pl" })
        .expect(201);

      const afterAdd = await request(app.getHttpServer())
        .get(`/api/articles/section/${section.id}?language=en`)
        .set("Cookie", cookie)
        .expect(200);

      expect(afterAdd.body.data.availableLocales).toEqual(expect.arrayContaining(["en", "pl"]));

      await request(app.getHttpServer())
        .delete(`/api/articles/section/${section.id}/language?language=pl`)
        .set("Cookie", cookie)
        .expect(200);

      const afterRemove = await request(app.getHttpServer())
        .get(`/api/articles/section/${section.id}?language=en`)
        .set("Cookie", cookie)
        .expect(200);

      expect(afterRemove.body.data.availableLocales).toEqual(["en"]);
    });
  });

  describe("GET /api/articles/toc", () => {
    it("returns sections with article items", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "TOC" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Article A",
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles/toc?language=en")
        .expect(200);

      expect(response.body.data.sections.length).toBe(1);
      expect(response.body.data.sections[0].articles[0].title).toBe("Article A");
    });
  });
});
