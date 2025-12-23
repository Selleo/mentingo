import request from "supertest";

import { USER_ROLES } from "src/user/schemas/userRoles";

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

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get("DB");
    userFactory = createUserFactory(db);
    articleFactory = createArticleFactory(db);
    sectionFactory = createArticleSectionFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateTables(db, [
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
