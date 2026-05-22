import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

const CATEGORIES_COUNT = 10;

describe("CategoryController (e2e)", () => {
  let app: INestApplication;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    settingsFactory = createSettingsFactory(db);
    await categoryFactory.createList(CATEGORIES_COUNT);
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
  });

  const password = "password123";

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateTables(db, ["settings"]);
  });

  describe("POST /api/category", () => {
    describe("when user is a student", () => {
      it("returns archived and createdAt equal to null", async () => {
        const user = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

        const response = await request(app.getHttpServer())
          .get("/api/category")
          .set("Cookie", await cookieFor(user, app))
          .expect(200);

        const responseData = response.body.data;

        expect(responseData[0]).toHaveProperty("id");
        expect(responseData[0]).toHaveProperty("title");
        expect(responseData[0].archived).toBe(null);
        expect(responseData[0].createdAt).toBe(null);
      });
    });

    describe("when user is an admin", () => {
      it("returns all filled category columns", async () => {
        const user = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

        const response = await request(app.getHttpServer())
          .get("/api/category")
          .set("Cookie", await cookieFor(user, app))
          .expect(200);

        const responseData = response.body.data;

        expect(responseData[0]).toHaveProperty("id");
        expect(responseData[0]).toHaveProperty("title");
        expect(responseData[0]).toHaveProperty("archived");
        expect(responseData[0]).toHaveProperty("createdAt");
        expect(responseData[0].createdAt).not.toBe(null);
      });
    });

    describe("when the request includes query params", () => {
      it("returns categories properly paginated", async () => {
        let perPage = 5;
        let page = 1;
        const user = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

        const response = await request(app.getHttpServer())
          .get(`/api/category?perPage=${perPage}&page=${page}`)
          .set("Cookie", await cookieFor(user, app))
          .expect(200);

        const paginationData = response.body.pagination;

        expect(response.body.data).toHaveLength(perPage);
        expect(paginationData.totalItems).toBe(CATEGORIES_COUNT);
        expect(paginationData.page).toBe(page);
        expect(paginationData.perPage).toBe(perPage);

        perPage = 8;
        page = 2;

        const res = await request(app.getHttpServer())
          .get(`/api/category?perPage=${perPage}&page=${page}`)
          .set("Cookie", await cookieFor(user, app))
          .expect(200);

        expect(res.body.data).toHaveLength(CATEGORIES_COUNT - perPage);
        expect(res.body.pagination.totalItems).toBe(CATEGORIES_COUNT);
      });
    });

    it("requires a base language when creating categories and rejects duplicate base titles", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookie = await cookieFor(user, app);
      const title = `Explicit English Category ${Date.now()}`;

      await request(app.getHttpServer())
        .post("/api/category")
        .set("Cookie", cookie)
        .send({ title })
        .expect(400);

      const createResponse = await request(app.getHttpServer())
        .post("/api/category")
        .set("Cookie", cookie)
        .send({ title, language: SUPPORTED_LANGUAGES.EN })
        .expect(201);

      const categoryId = createResponse.body.data.id;

      await request(app.getHttpServer())
        .get(`/api/category/${categoryId}`)
        .set("Cookie", cookie)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.title).toBe(title);
          expect(body.data.baseLanguage).toBe(SUPPORTED_LANGUAGES.EN);
          expect(body.data.availableLocales).toEqual([SUPPORTED_LANGUAGES.EN]);
        });

      await request(app.getHttpServer())
        .post("/api/category")
        .set("Cookie", cookie)
        .send({ title, language: SUPPORTED_LANGUAGES.EN })
        .expect(409)
        .expect(({ body }) => {
          expect(body.message).toBe("adminCategoryView.toast.alreadyExists");
        });
    });

    it("localizes category details, list responses, and title filters by requested language", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookie = await cookieFor(user, app);
      const suffix = Date.now();
      const englishTitle = `Localized Category English ${suffix}`;
      const germanTitle = `Lokalisierte Kategorie Deutsch ${suffix}`;

      const createResponse = await request(app.getHttpServer())
        .post("/api/category")
        .set("Cookie", cookie)
        .send({ title: englishTitle, language: SUPPORTED_LANGUAGES.EN })
        .expect(201);

      const categoryId = createResponse.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/category/${categoryId}/language`)
        .query({ language: SUPPORTED_LANGUAGES.DE })
        .set("Cookie", cookie)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/category/${categoryId}`)
        .set("Cookie", cookie)
        .send({ title: germanTitle, language: SUPPORTED_LANGUAGES.DE })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/category/${categoryId}`)
        .query({ language: SUPPORTED_LANGUAGES.DE })
        .set("Cookie", cookie)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.title).toBe(germanTitle);
        });

      await request(app.getHttpServer())
        .get(`/api/category/${categoryId}`)
        .query({ language: SUPPORTED_LANGUAGES.PL })
        .set("Cookie", cookie)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.title).toBe(englishTitle);
        });

      await request(app.getHttpServer())
        .get("/api/category")
        .query({
          title: germanTitle,
          language: SUPPORTED_LANGUAGES.DE,
          page: 1,
          perPage: 100,
        })
        .set("Cookie", cookie)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.map((category: { id: string }) => category.id)).toContain(categoryId);
        });

      await request(app.getHttpServer())
        .get("/api/category")
        .query({
          title: germanTitle,
          language: SUPPORTED_LANGUAGES.EN,
          page: 1,
          perPage: 100,
        })
        .set("Cookie", cookie)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.map((category: { id: string }) => category.id)).not.toContain(
            categoryId,
          );
        });

      await request(app.getHttpServer())
        .get("/api/category")
        .query({
          title: englishTitle,
          language: SUPPORTED_LANGUAGES.PL,
          page: 1,
          perPage: 100,
        })
        .set("Cookie", cookie)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.map((category: { id: string }) => category.id)).toContain(categoryId);
        });
    });

    it("allows managing category language variants and base language", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookie = await cookieFor(user, app);

      const englishTitle = `Category English ${Date.now()}`;
      const polishTitle = `Kategoria Polska ${Date.now()}`;

      const createResponse = await request(app.getHttpServer())
        .post("/api/category")
        .set("Cookie", cookie)
        .send({ title: englishTitle, language: SUPPORTED_LANGUAGES.EN })
        .expect(201);

      const categoryId = createResponse.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/category/${categoryId}/language`)
        .query({ language: SUPPORTED_LANGUAGES.PL })
        .set("Cookie", cookie)
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.title).toBe(englishTitle);
          expect(body.data.availableLocales).toEqual(
            expect.arrayContaining([SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL]),
          );
        });

      await request(app.getHttpServer())
        .patch(`/api/category/${categoryId}`)
        .set("Cookie", cookie)
        .send({ title: polishTitle, language: SUPPORTED_LANGUAGES.PL })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.title).toBe(polishTitle);
          expect(body.data.baseLanguage).toBe(SUPPORTED_LANGUAGES.EN);
        });

      await request(app.getHttpServer())
        .get(`/api/category/${categoryId}`)
        .query({ language: SUPPORTED_LANGUAGES.PL })
        .set("Cookie", cookie)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.title).toBe(polishTitle);
        });

      await request(app.getHttpServer())
        .patch(`/api/category/${categoryId}/base-language`)
        .set("Cookie", cookie)
        .send({ baseLanguage: SUPPORTED_LANGUAGES.PL })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.baseLanguage).toBe(SUPPORTED_LANGUAGES.PL);
          expect(body.data.title).toBe(polishTitle);
        });

      await request(app.getHttpServer())
        .delete(`/api/category/${categoryId}/language`)
        .query({ language: SUPPORTED_LANGUAGES.EN })
        .set("Cookie", cookie)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.availableLocales).toEqual([SUPPORTED_LANGUAGES.PL]);
          expect(body.data.title).toBe(polishTitle);
        });

      await request(app.getHttpServer())
        .delete(`/api/category/${categoryId}/language`)
        .query({ language: SUPPORTED_LANGUAGES.PL })
        .set("Cookie", cookie)
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toBe("adminCategoryView.toast.invalidLanguageToDelete");
        });
    });

    it("rejects invalid language variant operations", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookie = await cookieFor(user, app);
      const title = `Invalid Language Category ${Date.now()}`;

      const createResponse = await request(app.getHttpServer())
        .post("/api/category")
        .set("Cookie", cookie)
        .send({ title, language: SUPPORTED_LANGUAGES.EN })
        .expect(201);

      const categoryId = createResponse.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/category/${categoryId}/language`)
        .query({ language: SUPPORTED_LANGUAGES.EN })
        .set("Cookie", cookie)
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toBe("adminCategoryView.toast.languageAlreadyExists");
        });

      await request(app.getHttpServer())
        .patch(`/api/category/${categoryId}`)
        .set("Cookie", cookie)
        .send({ title: "German title without variant", language: SUPPORTED_LANGUAGES.DE })
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toBe("adminCategoryView.toast.languageNotSupported");
        });

      await request(app.getHttpServer())
        .patch(`/api/category/${categoryId}/base-language`)
        .set("Cookie", cookie)
        .send({ baseLanguage: SUPPORTED_LANGUAGES.DE })
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toBe("adminCategoryView.toast.languageNotSupported");
        });

      await request(app.getHttpServer())
        .delete(`/api/category/${categoryId}/language`)
        .query({ language: SUPPORTED_LANGUAGES.DE })
        .set("Cookie", cookie)
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toBe("adminCategoryView.toast.invalidLanguageToDelete");
        });
    });

    it("returns a translation key when the category does not exist", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      await request(app.getHttpServer())
        .get(`/api/category/${randomUUID()}`)
        .set("Cookie", await cookieFor(user, app))
        .expect(404)
        .expect(({ body }) => {
          expect(body.message).toBe("adminCategoryView.error.categoryNotFound");
        });
    });

    it("returns a translated error when deleting a category assigned to courses", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookie = await cookieFor(user, app);
      const categoryTitle = `Assigned Category ${Date.now()}`;
      const courseTitle = `Assigned Course ${Date.now()}`;

      const createResponse = await request(app.getHttpServer())
        .post("/api/category")
        .set("Cookie", cookie)
        .send({ title: categoryTitle, language: SUPPORTED_LANGUAGES.EN })
        .expect(201);

      const categoryId = createResponse.body.data.id;

      await courseFactory.create({
        title: courseTitle,
        authorId: user.id,
        categoryId,
        status: "published",
        thumbnailS3Key: null,
      });

      await request(app.getHttpServer())
        .delete(`/api/category/deleteCategory/${categoryId}`)
        .set("Cookie", cookie)
        .expect(422)
        .expect(({ body }) => {
          expect(body.message).toBe("adminCategoriesView.toast.deleteCategoryAssignedToCourses");
          expect(body.translationParams).toEqual({
            courseCount: 1,
            courseTitles: courseTitle,
          });
        });
    });

    it("limits assigned course names in category delete errors", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookie = await cookieFor(user, app);
      const categoryTitle = `Assigned Category ${Date.now()}`;
      const courseTitles = [
        `Assigned Course A ${Date.now()}`,
        `Assigned Course B ${Date.now()}`,
        `Assigned Course C ${Date.now()}`,
      ];

      const createResponse = await request(app.getHttpServer())
        .post("/api/category")
        .set("Cookie", cookie)
        .send({ title: categoryTitle, language: SUPPORTED_LANGUAGES.EN })
        .expect(201);

      const categoryId = createResponse.body.data.id;

      await Promise.all(
        courseTitles.map((courseTitle) =>
          courseFactory.create({
            title: courseTitle,
            authorId: user.id,
            categoryId,
            status: "published",
            thumbnailS3Key: null,
          }),
        ),
      );

      await request(app.getHttpServer())
        .delete(`/api/category/deleteCategory/${categoryId}`)
        .set("Cookie", cookie)
        .expect(422)
        .expect(({ body }) => {
          expect(body.message).toBe("adminCategoriesView.toast.deleteCategoryAssignedToCourses");
          expect(body.translationParams.courseCount).toBe(3);

          const displayedCourseTitles = body.translationParams.courseTitles.split(", ") as string[];

          expect(displayedCourseTitles).toHaveLength(2);
          expect(
            displayedCourseTitles.every((courseTitle: string) =>
              courseTitles.includes(courseTitle),
            ),
          ).toBe(true);
        });
    });
  });
});
