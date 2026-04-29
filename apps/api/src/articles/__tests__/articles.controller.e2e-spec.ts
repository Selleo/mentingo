import { ENTITY_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, isNull } from "drizzle-orm";
import request from "supertest";

import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  articles,
  articleSections,
  resourceEntity,
  resources,
  settings,
} from "src/storage/schema";
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

  const setGlobalSettings = async (overrides: Partial<typeof DEFAULT_GLOBAL_SETTINGS> = {}) => {
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

  const createAdmin = async () => {
    return userFactory.withCredentials({ password }).withAdminSettings(db).create({
      role: SYSTEM_ROLE_SLUGS.ADMIN,
    });
  };

  const createStudent = async () => {
    return userFactory.withCredentials({ password }).withUserSettings(db).create({
      role: SYSTEM_ROLE_SLUGS.STUDENT,
    });
  };

  const createContentCreator = async () => {
    return userFactory.withCredentials({ password }).withContentCreatorSettings(db).create({
      role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    });
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
    await settingsFactory.create();
    await setGlobalSettings({
      articlesEnabled: true,
      unregisteredUserArticlesAccessibility: true,
    });
  });

  afterEach(async () => {
    await truncateTables(baseDb, [
      "resource_entity",
      "resources",
      "articles",
      "article_sections",
      "outbox_events",
      "settings",
      "credentials",
      "user_onboarding",
      "users",
    ]);
  });

  describe("GET /api/articles", () => {
    it("returns only public published articles for guests", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Visibility" });

      const publicPublished = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Public article",
        isPublic: true,
        status: "published",
      });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Private article",
        isPublic: false,
        status: "published",
      });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Draft article",
        isPublic: true,
        status: "draft",
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles?language=en")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: publicPublished.id,
        title: "Public article",
        status: "published",
        isPublic: true,
      });
    });

    it("returns private published articles for authenticated admin", async () => {
      const admin = await createAdmin();
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Admin view" });

      const publicArticle = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Public article",
        isPublic: true,
      });

      const privateArticle = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Private article",
        isPublic: false,
      });

      const draftArticle = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Draft article",
        status: "draft",
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles?language=en")
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      const ids = response.body.map((article: { id: string }) => article.id);
      expect(ids).toEqual(expect.arrayContaining([publicArticle.id, privateArticle.id]));
      expect(ids).not.toContain(draftArticle.id);
    });

    it("applies full-text search for searchQuery with length >= 3", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Search" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Reset your password",
      });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Course completion tips",
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles?language=en&searchQuery=password")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe("Reset your password");
    });

    it("does not apply full-text search for short searchQuery", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Search short" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Article one",
      });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Article two",
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles?language=en&searchQuery=ab")
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it("returns 403 for guests when guest access is disabled", async () => {
      await setGlobalSettings({
        articlesEnabled: true,
        unregisteredUserArticlesAccessibility: false,
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles?language=en")
        .expect(403);

      expect(response.body.message).toBe("common.toast.noAccess");
    });
  });

  describe("GET /api/articles/:id", () => {
    it("returns public article for guest with content fields", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Read" });
      const article = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Public article",
        summary: "Summary",
        content: "<p>Content</p>",
        isPublic: true,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/articles/${article.id}?language=en`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: article.id,
        title: "Public article",
        summary: "Summary",
        plainContent: "<p>Content</p>",
        isPublic: true,
      });
      expect(typeof response.body.data.content).toBe("string");
      expect(response.body.data.resources).toBeDefined();
    });

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

    it("allows admin to read draft article in draft mode", async () => {
      const admin = await createAdmin();
      const draft = await articleFactory.create({
        title: "Draft title",
        status: "draft",
      });

      const response = await request(app.getHttpServer())
        .get(`/api/articles/${draft.id}?language=en&isDraftMode=true`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data.id).toBe(draft.id);
      expect(response.body.data.title).toBe("Draft title");
      expect(response.body.data.publishedAt).toBeNull();
    });

    it("returns 404 when non-admin requests draft mode", async () => {
      const article = await articleFactory.create({ title: "Public" });

      await request(app.getHttpServer())
        .get(`/api/articles/${article.id}?language=en&isDraftMode=true`)
        .expect(404);
    });

    it("returns adjacent article ids for published articles", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Adjacent" });

      const first = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "First",
        publishedAt: "2026-04-01T10:00:00.000Z",
      });

      const second = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Second",
        publishedAt: "2026-04-01T11:00:00.000Z",
      });

      const response = await request(app.getHttpServer())
        .get(`/api/articles/${first.id}?language=en`)
        .expect(200);

      expect(response.body.data.previousArticle).toBeNull();
      expect(response.body.data.nextArticle).toBe(second.id);
    });
  });

  describe("GET /api/articles/drafts", () => {
    it("requires authentication", async () => {
      await request(app.getHttpServer()).get("/api/articles/drafts?language=en").expect(401);
    });

    it("returns only draft articles for admin", async () => {
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

    it("forbids student access", async () => {
      const student = await createStudent();

      await request(app.getHttpServer())
        .get("/api/articles/drafts?language=en")
        .set("Cookie", await cookieFor(student, app))
        .expect(403);
    });
  });

  describe("POST /api/articles/section", () => {
    it("creates section for admin and persists localization defaults", async () => {
      const admin = await createAdmin();

      const response = await request(app.getHttpServer())
        .post("/api/articles/section")
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "en" })
        .expect(201);

      const [storedSection] = await db
        .select()
        .from(articleSections)
        .where(eq(articleSections.id, response.body.data.id));

      expect(storedSection).toBeDefined();
      expect(storedSection.baseLanguage).toBe("en");
      expect(storedSection.availableLocales).toEqual(["en"]);
      expect(storedSection.title).toEqual({ en: "Untitled section" });
    });

    it("rejects non-admin", async () => {
      const student = await createStudent();

      await request(app.getHttpServer())
        .post("/api/articles/section")
        .set("Cookie", await cookieFor(student, app))
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

    it("returns section details with assigned public article count", async () => {
      const admin = await createAdmin();
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Details" });

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
        .get(`/api/articles/section/${section.id}?language=en`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: section.id,
        title: "Details",
        assignedArticlesCount: 1,
      });
    });
  });

  describe("PATCH /api/articles/section/:id", () => {
    it("updates section title for admin and persists localized value", async () => {
      const admin = await createAdmin();
      const section = await sectionFactory.create({ title: "Old title" });

      const response = await request(app.getHttpServer())
        .patch(`/api/articles/section/${section.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "en", title: "New title" })
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: section.id,
        title: "New title",
      });

      const [storedSection] = await db
        .select()
        .from(articleSections)
        .where(eq(articleSections.id, section.id));
      expect(storedSection.title).toEqual({ en: "New title" });
    });

    it("returns 400 for unsupported section language", async () => {
      const admin = await createAdmin();
      const section = await sectionFactory.create({
        title: "Only EN",
        baseLanguage: "en",
        availableLocales: ["en"],
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/articles/section/${section.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "pl", title: "Now PL" })
        .expect(400);

      expect(response.body.message).toBe("adminArticleView.toast.invalidLanguageError");
    });
  });

  describe("POST /api/articles/section/:id/language and DELETE /api/articles/section/:id/language", () => {
    it("adds section language and blocks duplicate addition", async () => {
      const admin = await createAdmin();
      const section = await sectionFactory.create({ title: "Localized" });
      const cookie = await cookieFor(admin, app);

      const addResponse = await request(app.getHttpServer())
        .post(`/api/articles/section/${section.id}/language`)
        .set("Cookie", cookie)
        .send({ language: "pl" })
        .expect(201);

      expect(addResponse.body.data.title).toBe("Sekcja bez tytułu");

      const duplicateResponse = await request(app.getHttpServer())
        .post(`/api/articles/section/${section.id}/language`)
        .set("Cookie", cookie)
        .send({ language: "pl" })
        .expect(400);

      expect(duplicateResponse.body.message).toBe("adminArticleView.toast.languageAlreadyExists");
    });

    it("removes non-base section language and blocks base language removal", async () => {
      const admin = await createAdmin();
      const section = await sectionFactory.create({
        title: "Localized",
        baseLanguage: "en",
        availableLocales: ["en", "pl"],
      });
      const cookie = await cookieFor(admin, app);

      const removeResponse = await request(app.getHttpServer())
        .delete(`/api/articles/section/${section.id}/language?language=pl`)
        .set("Cookie", cookie)
        .expect(200);

      expect(removeResponse.body).toEqual({});

      const [storedSection] = await db
        .select()
        .from(articleSections)
        .where(eq(articleSections.id, section.id));
      expect(storedSection.availableLocales).toEqual(["en"]);

      const baseRemovalResponse = await request(app.getHttpServer())
        .delete(`/api/articles/section/${section.id}/language?language=en`)
        .set("Cookie", cookie)
        .expect(400);

      expect(baseRemovalResponse.body.message).toBe("adminArticleView.toast.minimumLanguageError");
    });
  });

  describe("DELETE /api/articles/section/:id", () => {
    it("deletes section when no public articles are assigned", async () => {
      const admin = await createAdmin();
      const section = await sectionFactory.create({ title: "Empty" });

      await request(app.getHttpServer())
        .delete(`/api/articles/section/${section.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      const [storedSection] = await db
        .select()
        .from(articleSections)
        .where(eq(articleSections.id, section.id));
      expect(storedSection).toBeUndefined();
    });

    it("blocks deleting section that has public assigned articles", async () => {
      const admin = await createAdmin();
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "With article" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        isPublic: true,
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/articles/section/${section.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(400);

      expect(response.body.message).toBe("adminArticleView.toast.sectionHasAssignedArticles");
    });
  });

  describe("GET /api/articles/toc", () => {
    it("returns visible sections and article items for guests", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "TOC" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Public article",
        isPublic: true,
        status: "published",
      });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Draft article",
        status: "draft",
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles/toc?language=en")
        .expect(200);

      expect(response.body.data.sections).toHaveLength(1);
      expect(response.body.data.sections[0].title).toBe("TOC");
      expect(response.body.data.sections[0].articles).toHaveLength(1);
      expect(response.body.data.sections[0].articles[0].title).toBe("Public article");
    });

    it("returns draft articles in toc when admin enables draft mode", async () => {
      const admin = await createAdmin();
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Draft TOC" });

      await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Draft article",
        status: "draft",
      });

      const response = await request(app.getHttpServer())
        .get("/api/articles/toc?language=en&isDraftMode=true")
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data.sections[0].articles).toHaveLength(1);
      expect(response.body.data.sections[0].articles[0].title).toBe("Draft article");
    });
  });

  describe("GET /api/articles/articles-resource/:resourceId", () => {
    it("returns 404 for non-existing resource", async () => {
      await request(app.getHttpServer())
        .get("/api/articles/articles-resource/7f1f9f30-0d7f-4d93-8f2f-0f271ec9728d")
        .expect(404);
    });

    it("returns 404 for guest when resource belongs to private draft article", async () => {
      const author = await userFactory.create();
      const section = await sectionFactory.create({ title: "Private resources" });
      const article = await articleFactory.create({
        articleSectionId: section.id,
        authorId: author.id,
        title: "Private",
        isPublic: false,
        status: "draft",
      });

      const [resource] = await db
        .insert(resources)
        .values({
          title: { en: "Resource" },
          description: { en: "Resource description" },
          reference: "missing/file.png",
          contentType: "image/png",
          uploadedBy: author.id,
        })
        .returning();

      await db.insert(resourceEntity).values({
        resourceId: resource.id,
        entityId: article.id,
        entityType: ENTITY_TYPES.ARTICLES,
        relationshipType: "attachment",
      });

      await request(app.getHttpServer())
        .get(`/api/articles/articles-resource/${resource.id}`)
        .expect(404);
    });
  });

  describe("POST /api/articles/article", () => {
    it("creates article for admin and persists defaults", async () => {
      const admin = await createAdmin();
      const section = await sectionFactory.create({ title: "Create" });

      const response = await request(app.getHttpServer())
        .post("/api/articles/article")
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "en", sectionId: section.id })
        .expect(201);

      const [storedArticle] = await db
        .select()
        .from(articles)
        .where(eq(articles.id, response.body.data.id));

      expect(storedArticle).toBeDefined();
      expect(storedArticle.baseLanguage).toBe("en");
      expect(storedArticle.availableLocales).toEqual(["en"]);
      expect(storedArticle.articleSectionId).toBe(section.id);
      expect(storedArticle.authorId).toBe(admin.id);
      expect(storedArticle.status).toBe("published");
      expect(storedArticle.publishedAt).not.toBeNull();
      expect(storedArticle.title).toEqual({ en: "Untitled Article" });
    });

    it("returns 403 for student", async () => {
      const student = await createStudent();
      const section = await sectionFactory.create({ title: "Section" });

      await request(app.getHttpServer())
        .post("/api/articles/article")
        .set("Cookie", await cookieFor(student, app))
        .send({ language: "en", sectionId: section.id })
        .expect(403);
    });

    it("returns 404 for non-existing section", async () => {
      const admin = await createAdmin();

      await request(app.getHttpServer())
        .post("/api/articles/article")
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "en", sectionId: "e2288f48-f876-4457-9a5b-6cfbfd3f5267" })
        .expect(404);
    });
  });

  describe("PATCH /api/articles/:id", () => {
    it("updates article localization and status fields", async () => {
      const admin = await createAdmin();
      const article = await articleFactory.create({
        title: "Before",
        summary: "Before summary",
        content: "<p>Before</p>",
        status: "published",
        isPublic: true,
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/articles/${article.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .send({
          language: "en",
          title: "After",
          summary: "After summary",
          content: "<p>After</p>",
          status: "draft",
          isPublic: false,
        })
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: article.id,
        title: "After",
      });

      const [storedArticle] = await db.select().from(articles).where(eq(articles.id, article.id));
      expect(storedArticle.status).toBe("draft");
      expect(storedArticle.isPublic).toBe(false);
      expect(storedArticle.publishedAt).toBeNull();
      expect(storedArticle.title).toEqual({ en: "After" });
      expect(storedArticle.summary).toEqual({ en: "After summary" });
      expect(storedArticle.content).toEqual({ en: '<p data-block-index="0">After</p>' });
    });

    it("returns 400 for unsupported article language", async () => {
      const admin = await createAdmin();
      const article = await articleFactory.create({
        baseLanguage: "en",
        availableLocales: ["en"],
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/articles/${article.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "pl", title: "PL" })
        .expect(400);

      expect(response.body.message).toBe("adminArticleView.toast.invalidLanguageError");
    });
  });

  describe("POST /api/articles/article/:id and DELETE /api/articles/:id/language", () => {
    it("adds article language and blocks duplicate language creation", async () => {
      const admin = await createAdmin();
      const article = await articleFactory.create({
        baseLanguage: "en",
        availableLocales: ["en"],
      });

      const addResponse = await request(app.getHttpServer())
        .post(`/api/articles/article/${article.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "pl" })
        .expect(201);

      expect(addResponse.body.data.title).toBe("Artykuł bez tytułu");

      const duplicateResponse = await request(app.getHttpServer())
        .post(`/api/articles/article/${article.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "pl" })
        .expect(400);

      expect(duplicateResponse.body.message).toBe("adminArticleView.toast.languageAlreadyExists");
    });

    it("removes non-base article language and blocks removing the base language", async () => {
      const admin = await createAdmin();
      const article = await articleFactory.create({
        baseLanguage: "en",
        availableLocales: ["en", "pl"],
      });

      await request(app.getHttpServer())
        .delete(`/api/articles/${article.id}/language?language=pl`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      const [storedArticle] = await db.select().from(articles).where(eq(articles.id, article.id));
      expect(storedArticle.availableLocales).toEqual(["en"]);
      expect((storedArticle.title as Record<string, string>).pl).toBeUndefined();

      const baseRemovalResponse = await request(app.getHttpServer())
        .delete(`/api/articles/${article.id}/language?language=en`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(400);

      expect(baseRemovalResponse.body.message).toBe("adminArticleView.toast.minimumLanguageError");
    });
  });

  describe("DELETE /api/articles/:id", () => {
    it("soft-deletes article and keeps deletion idempotent", async () => {
      const admin = await createAdmin();
      const article = await articleFactory.create({
        status: "published",
        isPublic: true,
      });

      await request(app.getHttpServer())
        .delete(`/api/articles/${article.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      const [storedArticle] = await db.select().from(articles).where(eq(articles.id, article.id));
      expect(storedArticle.archived).toBe(true);
      expect(storedArticle.isPublic).toBe(false);

      await request(app.getHttpServer())
        .delete(`/api/articles/${article.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);
    });

    it("returns 404 for non-existing article", async () => {
      const admin = await createAdmin();

      await request(app.getHttpServer())
        .delete("/api/articles/ae22711f-235d-40ce-af68-3397f5534cf0")
        .set("Cookie", await cookieFor(admin, app))
        .expect(404);
    });

    it("returns noAccess when content creator tries deleting someone else's article", async () => {
      const creator = await createContentCreator();
      const article = await articleFactory.create();

      const response = await request(app.getHttpServer())
        .delete(`/api/articles/${article.id}`)
        .set("Cookie", await cookieFor(creator, app))
        .expect(400);

      expect(response.body.message).toBe("common.toast.noAccess");
    });
  });

  describe("POST /api/articles/:id/upload", () => {
    it("returns 401 when unauthenticated", async () => {
      const article = await articleFactory.create();

      await request(app.getHttpServer())
        .post(`/api/articles/${article.id}/upload`)
        .field("language", "en")
        .field("title", "Attachment")
        .field("description", "Attachment description")
        .attach("file", Buffer.from("dummy"), {
          filename: "doc.pdf",
          contentType: "application/pdf",
        })
        .expect(401);
    });

    it("returns 400 for unsupported file type", async () => {
      const admin = await createAdmin();
      const article = await articleFactory.create({ authorId: admin.id });

      await request(app.getHttpServer())
        .post(`/api/articles/${article.id}/upload`)
        .set("Cookie", await cookieFor(admin, app))
        .field("language", "en")
        .field("title", "Attachment")
        .field("description", "Attachment description")
        .attach("file", Buffer.from("plain text"), {
          filename: "bad.txt",
          contentType: "text/plain",
        })
        .expect(400);
    });
  });

  describe("POST /api/articles/preview", () => {
    it("returns parsed content preview for admin", async () => {
      const admin = await createAdmin();
      const article = await articleFactory.create({ baseLanguage: "en", availableLocales: ["en"] });

      const response = await request(app.getHttpServer())
        .post("/api/articles/preview")
        .set("Cookie", await cookieFor(admin, app))
        .send({
          articleId: article.id,
          language: "en",
          content: "<p>Hello preview</p>",
        })
        .expect(201);

      expect(response.body.data.parsedContent).toContain("Hello preview");
    });

    it("returns 401 when unauthenticated", async () => {
      const article = await articleFactory.create();

      await request(app.getHttpServer())
        .post("/api/articles/preview")
        .send({
          articleId: article.id,
          language: "en",
          content: "<p>Preview</p>",
        })
        .expect(401);
    });

    it("returns 400 when preview language is not available for article", async () => {
      const admin = await createAdmin();
      const article = await articleFactory.create({ baseLanguage: "en", availableLocales: ["en"] });

      const response = await request(app.getHttpServer())
        .post("/api/articles/preview")
        .set("Cookie", await cookieFor(admin, app))
        .send({
          articleId: article.id,
          language: "pl",
          content: "<p>Preview</p>",
        })
        .expect(400);

      expect(response.body.message).toBe("adminArticleView.toast.invalidLanguageError");
    });
  });
});
