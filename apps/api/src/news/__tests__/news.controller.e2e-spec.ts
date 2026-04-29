import { SYSTEM_ROLE_SLUGS, type SupportedLanguages } from "@repo/shared";
import { isNull, eq } from "drizzle-orm";
import request from "supertest";

import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { news, settings } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("NewsController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  const password = "Password123!";

  const seedGlobalSettings = async (
    overrides: Partial<typeof DEFAULT_GLOBAL_SETTINGS> = {},
  ) => {
    await settingsFactory.create({ userId: null });
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

  const createNewsRecord = async ({
    cookie,
    title,
    status = "published",
    isPublic = true,
  }: {
    cookie: string;
    title: string;
    status?: "draft" | "published";
    isPublic?: boolean;
  }) => {
    const createResponse = await request(app.getHttpServer())
      .post("/api/news")
      .set("Cookie", cookie)
      .send({ language: "en" })
      .expect(201);

    const newsId = createResponse.body.data.id as UUIDType;

    await request(app.getHttpServer())
      .patch(`/api/news/${newsId}`)
      .set("Cookie", cookie)
      .field("language", "en")
      .field("title", title)
      .field("summary", `${title} summary`)
      .field("content", `<p>${title} content</p>`)
      .field("status", status)
      .field("isPublic", isPublic ? "true" : "false")
      .expect(200);

    return { id: newsId };
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  beforeEach(async () => {
    await seedGlobalSettings({
      newsEnabled: true,
      unregisteredUserNewsAccessibility: true,
    });
  });

  afterEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/news", () => {
    it("returns only published and public news for unauthenticated users", async () => {
      const author = await createAdmin();
      const authorCookie = await cookieFor(author, app);

      await createNewsRecord({
        cookie: authorCookie,
        title: "Public published",
        status: "published",
        isPublic: true,
      });
      await createNewsRecord({
        cookie: authorCookie,
        title: "Private published",
        status: "published",
        isPublic: false,
      });
      await createNewsRecord({
        cookie: authorCookie,
        title: "Public draft",
        status: "draft",
        isPublic: true,
      });

      const response = await request(app.getHttpServer()).get("/api/news?language=en").expect(200);

      expect(response.body.pagination.totalItems).toBe(1);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe("Public published");
      expect(response.body.data[0].status).toBe("published");
      expect(response.body.data[0].isPublic).toBe(true);
    });

    it("applies custom pagination (7 items on page 1, then 9)", async () => {
      const author = await createAdmin();
      const authorCookie = await cookieFor(author, app);

      for (let i = 0; i < 8; i += 1) {
        await createNewsRecord({
          cookie: authorCookie,
          title: `Paginated news ${i}`,
          status: "published",
          isPublic: true,
        });
      }

      const pageOne = await request(app.getHttpServer())
        .get("/api/news?language=en&page=1")
        .expect(200);

      expect(pageOne.body.pagination.totalItems).toBe(8);
      expect(pageOne.body.pagination.page).toBe(1);
      expect(pageOne.body.pagination.perPage).toBe(7);
      expect(pageOne.body.data).toHaveLength(7);

      const pageTwo = await request(app.getHttpServer())
        .get("/api/news?language=en&page=2")
        .expect(200);

      expect(pageTwo.body.pagination.totalItems).toBe(8);
      expect(pageTwo.body.pagination.page).toBe(2);
      expect(pageTwo.body.pagination.perPage).toBe(9);
      expect(pageTwo.body.data).toHaveLength(1);
    });

    it("filters results with searchQuery when length is >= 3", async () => {
      const author = await createAdmin();
      const authorCookie = await cookieFor(author, app);

      await createNewsRecord({ cookie: authorCookie, title: "Alpha launch notes" });
      await createNewsRecord({ cookie: authorCookie, title: "Beta digest" });

      const response = await request(app.getHttpServer())
        .get("/api/news?language=en&searchQuery=Alpha")
        .expect(200);

      expect(response.body.pagination.totalItems).toBe(1);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe("Alpha launch notes");
    });

    it("returns 400 for guest when guest news access is disabled", async () => {
      await seedGlobalSettings({
        newsEnabled: true,
        unregisteredUserNewsAccessibility: false,
      });

      const response = await request(app.getHttpServer()).get("/api/news?language=en").expect(400);

      expect(response.body.message).toBe("common.toast.noAccess");
    });
  });

  describe("GET /api/news/:id", () => {
    it("returns published public news for guest", async () => {
      const author = await createAdmin();
      const authorCookie = await cookieFor(author, app);
      const createdNews = await createNewsRecord({
        cookie: authorCookie,
        title: "Readable by guests",
      });

      const response = await request(app.getHttpServer())
        .get(`/api/news/${createdNews.id}?language=en`)
        .expect(200);

      expect(response.body.data.id).toBe(createdNews.id);
      expect(response.body.data.title).toBe("Readable by guests");
      expect(response.body.data.plainContent).toContain("Readable by guests content");
      expect(response.body.data.nextNews).toBe(null);
      expect(response.body.data.previousNews).toBe(null);
    });

    it("returns 404 for draft news for guest", async () => {
      const author = await createAdmin();
      const authorCookie = await cookieFor(author, app);
      const createdNews = await createNewsRecord({
        cookie: authorCookie,
        title: "Draft hidden from guests",
        status: "draft",
      });

      await request(app.getHttpServer())
        .get(`/api/news/${createdNews.id}?language=en`)
        .expect(404);
    });

    it("allows admin to read draft news", async () => {
      const admin = await createAdmin();
      const adminCookie = await cookieFor(admin, app);
      const createdNews = await createNewsRecord({
        cookie: adminCookie,
        title: "Draft visible for admin",
        status: "draft",
      });

      const response = await request(app.getHttpServer())
        .get(`/api/news/${createdNews.id}?language=en`)
        .set("Cookie", adminCookie)
        .expect(200);

      expect(response.body.data.id).toBe(createdNews.id);
      expect(response.body.data.status).toBe("draft");
      expect(response.body.data.title).toBe("Draft visible for admin");
    });
  });

  describe("GET /api/news/news-resource/:resourceId", () => {
    it("returns 404 for non-existing resource", async () => {
      await request(app.getHttpServer())
        .get("/api/news/news-resource/00000000-0000-0000-0000-000000000000")
        .expect(404);
    });
  });

  describe("GET /api/news/drafts", () => {
    it("returns 401 when unauthenticated", async () => {
      await request(app.getHttpServer()).get("/api/news/drafts?language=en").expect(401);
    });

    it("returns only draft news for admin", async () => {
      const admin = await createAdmin();
      const adminCookie = await cookieFor(admin, app);

      const draft = await createNewsRecord({
        cookie: adminCookie,
        title: "Draft one",
        status: "draft",
      });

      await createNewsRecord({
        cookie: adminCookie,
        title: "Published one",
        status: "published",
      });

      const response = await request(app.getHttpServer())
        .get("/api/news/drafts?language=en")
        .set("Cookie", adminCookie)
        .expect(200);

      expect(response.body.pagination.totalItems).toBe(1);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(draft.id);
      expect(response.body.data[0].status).toBe("draft");
    });
  });

  describe("POST /api/news", () => {
    it("creates news for admin and persists defaults", async () => {
      const admin = await createAdmin();

      const response = await request(app.getHttpServer())
        .post("/api/news")
        .set("Cookie", await cookieFor(admin, app))
        .send({ language: "en" })
        .expect(201);

      const createdId = response.body.data.id as UUIDType;
      expect(response.body.data.title).toBe("Untitled Article");

      const [storedNews] = await db
        .select({
          id: news.id,
          title: news.title,
          baseLanguage: news.baseLanguage,
          availableLocales: news.availableLocales,
          authorId: news.authorId,
          status: news.status,
          publishedAt: news.publishedAt,
        })
        .from(news)
        .where(eq(news.id, createdId))
        .limit(1);

      expect(storedNews.id).toBe(createdId);
      expect(storedNews.authorId).toBe(admin.id);
      expect(storedNews.baseLanguage).toBe("en");
      expect(storedNews.availableLocales).toEqual(["en"]);
      expect((storedNews.title as Record<string, string>).en).toBe("Untitled Article");
      expect(storedNews.status).toBe("draft");
      expect(storedNews.publishedAt).toBeNull();
    });

    it("returns 403 for student", async () => {
      const student = await createStudent();

      await request(app.getHttpServer())
        .post("/api/news")
        .set("Cookie", await cookieFor(student, app))
        .send({ language: "en" })
        .expect(403);
    });
  });

  describe("PATCH /api/news/:id", () => {
    it("updates content/status/isPublic and persists changes", async () => {
      const admin = await createAdmin();
      const cookie = await cookieFor(admin, app);
      const createdNews = await createNewsRecord({
        cookie,
        title: "Needs update",
        status: "draft",
        isPublic: true,
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/news/${createdNews.id}`)
        .set("Cookie", cookie)
        .field("language", "en")
        .field("title", "Updated title")
        .field("summary", "Updated summary")
        .field("content", "<p>Updated content</p>")
        .field("status", "published")
        .field("isPublic", "false")
        .expect(200);

      expect(response.body.data.id).toBe(createdNews.id);
      expect(response.body.data.title).toBe("Updated title");

      const [storedNews] = await db
        .select({
          id: news.id,
          title: news.title,
          summary: news.summary,
          content: news.content,
          status: news.status,
          isPublic: news.isPublic,
          publishedAt: news.publishedAt,
        })
        .from(news)
        .where(eq(news.id, createdNews.id))
        .limit(1);

      expect((storedNews.title as Record<string, string>).en).toBe("Updated title");
      expect((storedNews.summary as Record<string, string>).en).toBe("Updated summary");
      expect((storedNews.content as Record<string, string>).en).toContain("Updated content");
      expect(storedNews.status).toBe("published");
      expect(storedNews.isPublic).toBe(false);
      expect(storedNews.publishedAt).not.toBeNull();
    });
  });

  describe("POST /api/news/:id (language) and DELETE /api/news/:id/language", () => {
    it("adds language and blocks duplicate language addition", async () => {
      const admin = await createAdmin();
      const cookie = await cookieFor(admin, app);
      const createdNews = await createNewsRecord({ cookie, title: "Localized news" });

      await request(app.getHttpServer())
        .post(`/api/news/${createdNews.id}`)
        .set("Cookie", cookie)
        .send({ language: "pl" })
        .expect(201);

      const [afterAdd] = await db
        .select({ availableLocales: news.availableLocales })
        .from(news)
        .where(eq(news.id, createdNews.id))
        .limit(1);

      expect(afterAdd.availableLocales).toEqual(expect.arrayContaining(["en", "pl"]));

      const duplicate = await request(app.getHttpServer())
        .post(`/api/news/${createdNews.id}`)
        .set("Cookie", cookie)
        .send({ language: "pl" })
        .expect(400);

      expect(duplicate.body.message).toBe("adminNewsView.toast.languageAlreadyExists");
    });

    it("removes non-base language and blocks base language removal", async () => {
      const admin = await createAdmin();
      const cookie = await cookieFor(admin, app);
      const createdNews = await createNewsRecord({ cookie, title: "Multilingual news" });

      await request(app.getHttpServer())
        .post(`/api/news/${createdNews.id}`)
        .set("Cookie", cookie)
        .send({ language: "pl" })
        .expect(201);

      const removeResponse = await request(app.getHttpServer())
        .delete(`/api/news/${createdNews.id}/language?language=pl`)
        .set("Cookie", cookie)
        .expect(200);

      expect(removeResponse.body.data.id).toBe(createdNews.id);
      expect(removeResponse.body.data.availableLocales).toEqual(["en"]);

      const removeBase = await request(app.getHttpServer())
        .delete(`/api/news/${createdNews.id}/language?language=en`)
        .set("Cookie", cookie)
        .expect(400);

      expect(removeBase.body.message).toBe("adminNewsView.toast.minimumLanguageError");
    });
  });

  describe("DELETE /api/news/:id", () => {
    it("soft-deletes news and keeps operation idempotent", async () => {
      const admin = await createAdmin();
      const cookie = await cookieFor(admin, app);
      const createdNews = await createNewsRecord({ cookie, title: "Delete me" });

      const firstDelete = await request(app.getHttpServer())
        .delete(`/api/news/${createdNews.id}`)
        .set("Cookie", cookie)
        .expect(200);

      expect(firstDelete.body.data.id).toBe(createdNews.id);

      const [storedNews] = await db
        .select({ archived: news.archived, isPublic: news.isPublic })
        .from(news)
        .where(eq(news.id, createdNews.id))
        .limit(1);

      expect(storedNews.archived).toBe(true);
      expect(storedNews.isPublic).toBe(false);

      const secondDelete = await request(app.getHttpServer())
        .delete(`/api/news/${createdNews.id}`)
        .set("Cookie", cookie)
        .expect(200);

      expect(secondDelete.body.data.id).toBe(createdNews.id);
    });
  });

  describe("POST /api/news/preview", () => {
    it("renders preview content for admin", async () => {
      const admin = await createAdmin();
      const cookie = await cookieFor(admin, app);
      const createdNews = await createNewsRecord({ cookie, title: "Preview target" });

      const response = await request(app.getHttpServer())
        .post("/api/news/preview")
        .set("Cookie", cookie)
        .send({
          newsId: createdNews.id,
          language: "en",
          content: "<p>Preview content</p>",
        })
        .expect(201);

      expect(response.body.data.parsedContent).toContain("Preview content");
    });
  });

  describe("POST /api/news/:id/upload", () => {
    it("returns 401 when unauthenticated", async () => {
      await request(app.getHttpServer())
        .post("/api/news/00000000-0000-0000-0000-000000000000/upload")
        .expect(401);
    });
  });
});
