import { NEWS_STATUS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { isNull } from "drizzle-orm";
import request from "supertest";

import { FileGuard } from "src/file/guards/file.guard";
import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { news, settings } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createNewsFactory } from "../../../test/factory/news.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("NewsController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let newsFactory: ReturnType<typeof createNewsFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  const password = "Password123!";

  const createAdmin = () =>
    userFactory
      .withCredentials({ password })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

  const createContentCreator = () =>
    userFactory
      .withCredentials({ password })
      .withContentCreatorSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });

  const createStudent = () =>
    userFactory
      .withCredentials({ password })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

  const seedGlobalSettings = async (overrides: Partial<typeof DEFAULT_GLOBAL_SETTINGS> = {}) => {
    await settingsFactory.create();
    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_GLOBAL_SETTINGS,
          newsEnabled: true,
          unregisteredUserNewsAccessibility: true,
          ...overrides,
        }),
      })
      .where(isNull(settings.userId));
  };

  beforeAll(async () => {
    const testContext = await createE2ETest();
    app = testContext.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    newsFactory = createNewsFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  beforeEach(async () => {
    await seedGlobalSettings();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await truncateTables(baseDb, [
      "news",
      "search_documents",
      "outbox_events",
      "settings",
      "credentials",
      "user_onboarding",
      "users",
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("reading published news", () => {
    it("returns only public, published, non-archived news in the requested language to a visitor", async () => {
      const author = await userFactory.create();
      const visible = await newsFactory.create({ authorId: author.id, title: "Visible news" });
      await newsFactory.create({ authorId: author.id, title: "Private", isPublic: false });
      await newsFactory.create({ authorId: author.id, title: "Draft", status: NEWS_STATUS.DRAFT });
      await newsFactory.create({ authorId: author.id, title: "Archived", archived: true });
      await newsFactory.create({
        authorId: author.id,
        title: "Polish",
        baseLanguage: "pl",
        availableLocales: ["pl"],
      });

      const response = await request(app.getHttpServer()).get("/api/news?language=en").expect(200);

      expect(response.body.data).toEqual([expect.objectContaining({ id: visible.id })]);
      expect(response.body.pagination).toMatchObject({ totalItems: 1, page: 1, perPage: 7 });
    });

    it("lets a student read public and private published news", async () => {
      const student = await createStudent();
      const author = await userFactory.create();
      const publicNews = await newsFactory.create({ authorId: author.id });
      const privateNews = await newsFactory.create({ authorId: author.id, isPublic: false });

      const response = await request(app.getHttpServer())
        .get("/api/news?language=en")
        .set("Cookie", await cookieFor(student, app))
        .expect(200);

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual(
        expect.arrayContaining([publicNews.id, privateNews.id]),
      );
    });

    it("denies anonymous reading when unregistered access is disabled", async () => {
      await seedGlobalSettings({ unregisteredUserNewsAccessibility: false });

      const response = await request(app.getHttpServer()).get("/api/news?language=en").expect(400);

      expect(response.body.message).toBe("common.toast.noAccess");
    });

    it("uses base-language fallback for managers but strictly filters visitor locales", async () => {
      const admin = await createAdmin();
      const item = await newsFactory.create({ authorId: admin.id, title: "English title" });

      const adminResponse = await request(app.getHttpServer())
        .get(`/api/news/${item.id}?language=pl`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(adminResponse.body.data.title).toBe("English title");
      await request(app.getHttpServer()).get(`/api/news/${item.id}?language=pl`).expect(404);
    });

    it("returns adjacent published news and no neighbors for a draft", async () => {
      const admin = await createAdmin();
      const older = await newsFactory.create({
        authorId: admin.id,
        publishedAt: "2025-01-01T00:00:00.000Z",
      });
      const middle = await newsFactory.create({
        authorId: admin.id,
        publishedAt: "2025-01-02T00:00:00.000Z",
      });
      const newer = await newsFactory.create({
        authorId: admin.id,
        publishedAt: "2025-01-03T00:00:00.000Z",
      });
      const draft = await newsFactory.create({ authorId: admin.id, status: NEWS_STATUS.DRAFT });
      const cookie = await cookieFor(admin, app);

      const publishedResponse = await request(app.getHttpServer())
        .get(`/api/news/${middle.id}?language=en`)
        .set("Cookie", cookie)
        .expect(200);
      const draftResponse = await request(app.getHttpServer())
        .get(`/api/news/${draft.id}?language=en`)
        .set("Cookie", cookie)
        .expect(200);

      expect(publishedResponse.body.data).toMatchObject({
        nextNews: newer.id,
        previousNews: older.id,
      });
      expect(draftResponse.body.data).toMatchObject({ nextNews: null, previousNews: null });
    });

    it("uses the first-page and subsequent-page pagination sizes", async () => {
      const author = await userFactory.create();
      await Promise.all(
        Array.from({ length: 17 }, (_, index) =>
          newsFactory.create({ authorId: author.id, title: `News ${index}` }),
        ),
      );

      const firstPage = await request(app.getHttpServer()).get("/api/news?language=en").expect(200);
      const secondPage = await request(app.getHttpServer())
        .get("/api/news?language=en&page=2")
        .expect(200);
      const thirdPage = await request(app.getHttpServer())
        .get("/api/news?language=en&page=3")
        .expect(200);

      expect(firstPage.body.data).toHaveLength(7);
      expect(firstPage.body.pagination).toMatchObject({ page: 1, perPage: 7, totalItems: 17 });
      expect(secondPage.body.data).toHaveLength(9);
      expect(secondPage.body.pagination).toMatchObject({ page: 2, perPage: 9 });
      expect(thirdPage.body.data).toHaveLength(1);
    });
  });

  describe("managing drafts and ownership", () => {
    it("requires authentication and a news management permission for drafts", async () => {
      await request(app.getHttpServer()).get("/api/news/drafts?language=en").expect(401);

      const student = await createStudent();
      await request(app.getHttpServer())
        .get("/api/news/drafts?language=en")
        .set("Cookie", await cookieFor(student, app))
        .expect(403);
    });

    it("returns all drafts to an admin and only owned drafts to a content creator", async () => {
      const admin = await createAdmin();
      const owner = await createContentCreator();
      const other = await createContentCreator();
      const ownDraft = await newsFactory.create({ authorId: owner.id, status: NEWS_STATUS.DRAFT });
      const otherDraft = await newsFactory.create({
        authorId: other.id,
        status: NEWS_STATUS.DRAFT,
      });
      await newsFactory.create({ authorId: owner.id, status: NEWS_STATUS.PUBLISHED });

      const adminResponse = await request(app.getHttpServer())
        .get("/api/news/drafts?language=en")
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);
      const ownerResponse = await request(app.getHttpServer())
        .get("/api/news/drafts?language=en")
        .set("Cookie", await cookieFor(owner, app))
        .expect(200);

      expect(adminResponse.body.data.map(({ id }: { id: string }) => id)).toEqual(
        expect.arrayContaining([ownDraft.id, otherDraft.id]),
      );
      expect(ownerResponse.body.data).toEqual([expect.objectContaining({ id: ownDraft.id })]);
    });

    it("allows an owner to open and update a draft and hides it from another creator", async () => {
      const owner = await createContentCreator();
      const other = await createContentCreator();
      const item = await newsFactory.create({ authorId: owner.id, status: NEWS_STATUS.DRAFT });

      await request(app.getHttpServer())
        .get(`/api/news/${item.id}?language=en`)
        .set("Cookie", await cookieFor(owner, app))
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/news/${item.id}?language=en`)
        .set("Cookie", await cookieFor(other, app))
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/news/${item.id}`)
        .set("Cookie", await cookieFor(other, app))
        .field("translations", JSON.stringify([{ language: "en", title: "Forbidden" }]))
        .expect(404);
    });
  });

  describe("creating and updating news", () => {
    const pngFile = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );

    it("creates a draft in the requested base language", async () => {
      const creator = await createContentCreator();

      const response = await request(app.getHttpServer())
        .post("/api/news")
        .set("Cookie", await cookieFor(creator, app))
        .send({ language: "pl" })
        .expect(201);

      const [created] = await db.select().from(news);
      expect(response.body.data.id).toBe(created.id);
      expect(created).toMatchObject({
        authorId: creator.id,
        baseLanguage: "pl",
        availableLocales: ["pl"],
        status: NEWS_STATUS.DRAFT,
      });
    });

    it("updates multiple translations, publishes, normalizes content, and changes visibility", async () => {
      const admin = await createAdmin();
      const item = await newsFactory.create({ authorId: admin.id, status: NEWS_STATUS.DRAFT });

      await request(app.getHttpServer())
        .patch(`/api/news/${item.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .field(
          "translations",
          JSON.stringify([
            { language: "en", title: "English title", content: "<p>English</p>" },
            { language: "pl", title: "Polski tytul", content: "<p>Polski</p>" },
          ]),
        )
        .field("status", NEWS_STATUS.PUBLISHED)
        .field("isPublic", "false")
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/news/${item.id}?language=pl`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data).toMatchObject({
        title: "Polski tytul",
        content: '<p data-block-index="0">Polski</p>',
        status: NEWS_STATUS.PUBLISHED,
        isPublic: false,
      });
      expect(response.body.data.availableLocales).toEqual(expect.arrayContaining(["en", "pl"]));
      expect(response.body.data.publishedAt).not.toBeNull();
    });

    it("rejects an empty update, duplicate translations, and publishing without every title", async () => {
      const admin = await createAdmin();
      const item = await newsFactory.create({ authorId: admin.id, status: NEWS_STATUS.DRAFT });
      const cookie = await cookieFor(admin, app);

      const empty = await request(app.getHttpServer())
        .patch(`/api/news/${item.id}`)
        .set("Cookie", cookie)
        .field("translations", "[]")
        .expect(400);
      const duplicate = await request(app.getHttpServer())
        .patch(`/api/news/${item.id}`)
        .set("Cookie", cookie)
        .field(
          "translations",
          JSON.stringify([
            { language: "en", title: "One" },
            { language: "en", title: "Two" },
          ]),
        )
        .expect(400);
      const missingTitle = await request(app.getHttpServer())
        .patch(`/api/news/${item.id}`)
        .set("Cookie", cookie)
        .field("translations", JSON.stringify([{ language: "pl", summary: "No title" }]))
        .field("status", NEWS_STATUS.PUBLISHED)
        .expect(400);

      expect(empty.body.message).toBe("adminNewsView.toast.updateError");
      expect(duplicate.body.message).toBe("adminNewsView.toast.updateError");
      expect(missingTitle.body.message).toBe("newsView.validation.titleRequired");
    });

    it("rejects malformed cover field languages and ignores unrelated multipart files", async () => {
      const admin = await createAdmin();
      const item = await newsFactory.create({ authorId: admin.id });
      const cookie = await cookieFor(admin, app);
      jest.spyOn(FileGuard, "getFileType").mockResolvedValue({ ext: "png", mime: "image/png" });

      await request(app.getHttpServer())
        .patch(`/api/news/${item.id}`)
        .set("Cookie", cookie)
        .field("translations", "[]")
        .attach("cover.invalid", pngFile, {
          filename: "cover.png",
          contentType: "image/png",
        })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/news/${item.id}`)
        .set("Cookie", cookie)
        .field("translations", "[]")
        .field("isPublic", "false")
        .attach("unrelated", pngFile, {
          filename: "ignored.png",
          contentType: "image/png",
        })
        .expect(200);
    });
  });

  describe("managing languages", () => {
    it("adds a language and rejects adding it twice", async () => {
      const admin = await createAdmin();
      const item = await newsFactory.create({ authorId: admin.id });
      const cookie = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post(`/api/news/${item.id}`)
        .set("Cookie", cookie)
        .send({ language: "pl" })
        .expect(201);
      const duplicate = await request(app.getHttpServer())
        .post(`/api/news/${item.id}`)
        .set("Cookie", cookie)
        .send({ language: "pl" })
        .expect(400);

      expect(duplicate.body.message).toBe("adminNewsView.toast.languageAlreadyExists");
    });

    it("removes a non-base language", async () => {
      const admin = await createAdmin();
      const item = await newsFactory.create({
        authorId: admin.id,
        availableLocales: ["en", "pl"],
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/news/${item.id}/language?language=pl`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data).toMatchObject({ id: item.id, availableLocales: ["en"] });
    });

    it("rejects removing the only language or the base language", async () => {
      const admin = await createAdmin();
      const onlyLanguage = await newsFactory.create({ authorId: admin.id });
      const multilingual = await newsFactory.create({
        authorId: admin.id,
        availableLocales: ["en", "pl"],
      });
      const cookie = await cookieFor(admin, app);

      const minimum = await request(app.getHttpServer())
        .delete(`/api/news/${onlyLanguage.id}/language?language=en`)
        .set("Cookie", cookie)
        .expect(400);
      const base = await request(app.getHttpServer())
        .delete(`/api/news/${multilingual.id}/language?language=en`)
        .set("Cookie", cookie)
        .expect(400);

      expect(minimum.body.message).toBe("adminNewsView.toast.minimumLanguageError");
      expect(base.body.message).toBe("adminNewsView.toast.cannotRemoveBaseLanguage");
    });

    it("rejects an unavailable language for operations that require it", async () => {
      const admin = await createAdmin();
      const item = await newsFactory.create({ authorId: admin.id });

      const response = await request(app.getHttpServer())
        .post("/api/news/preview")
        .set("Cookie", await cookieFor(admin, app))
        .send({ newsId: item.id, language: "pl", content: "<p>Preview</p>" })
        .expect(400);

      expect(response.body.message).toBe("adminNewsView.toast.invalidLanguageError");
    });
  });

  describe("deleting news", () => {
    it("soft-deletes manageable news and hides it from readers", async () => {
      const creator = await createContentCreator();
      const item = await newsFactory.create({ authorId: creator.id });
      const cookie = await cookieFor(creator, app);

      await request(app.getHttpServer())
        .delete(`/api/news/${item.id}`)
        .set("Cookie", cookie)
        .expect(200);

      await request(app.getHttpServer()).get(`/api/news/${item.id}?language=en`).expect(404);
      const [deleted] = await db.select().from(news);
      expect(deleted).toMatchObject({ archived: true, isPublic: false });
    });

    it("does not allow a creator to delete another author's news", async () => {
      const owner = await createContentCreator();
      const other = await createContentCreator();
      const item = await newsFactory.create({ authorId: owner.id });

      await request(app.getHttpServer())
        .delete(`/api/news/${item.id}`)
        .set("Cookie", await cookieFor(other, app))
        .expect(404);
    });
  });
});
