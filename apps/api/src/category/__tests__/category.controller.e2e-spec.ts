import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
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
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    categoryFactory = createCategoryFactory(db);
    settingsFactory = createSettingsFactory(db);
    await categoryFactory.createList(CATEGORIES_COUNT);
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
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
  });

  describe("GET /api/category/:id", () => {
    it("returns category for admin", async () => {
      const category = await categoryFactory.create({ title: "Category For ID" });
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      const response = await request(app.getHttpServer())
        .get(`/api/category/${category.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data.id).toBe(category.id);
      expect(response.body.data.title).toBe("Category For ID");
    });

    it("returns 403 for student", async () => {
      const category = await categoryFactory.create({ title: "Student Forbidden Category" });
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

      await request(app.getHttpServer())
        .get(`/api/category/${category.id}`)
        .set("Cookie", await cookieFor(student, app))
        .expect(403);
    });
  });

  describe("POST /api/category", () => {
    it("creates category for admin", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      const response = await request(app.getHttpServer())
        .post("/api/category")
        .set("Cookie", await cookieFor(admin, app))
        .send({ title: "Created Category" })
        .expect(201);

      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.message).toBe("Category created");
    });
  });

  describe("PATCH /api/category/:id", () => {
    it("updates category for admin", async () => {
      const category = await categoryFactory.create({ title: "Before Update" });
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      const response = await request(app.getHttpServer())
        .patch(`/api/category/${category.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .send({ title: "After Update" })
        .expect(200);

      expect(response.body.data.id).toBe(category.id);
      expect(response.body.data.title).toBe("After Update");
    });
  });

  describe("DELETE /api/category/deleteCategory/:id", () => {
    it("deletes category for admin", async () => {
      const category = await categoryFactory.create({ title: "Delete Single Category" });
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      const response = await request(app.getHttpServer())
        .delete(`/api/category/deleteCategory/${category.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data.message).toBe("Category deleted successfully");
    });
  });

  describe("DELETE /api/category/deleteManyCategories", () => {
    it("deletes multiple categories for admin", async () => {
      const first = await categoryFactory.create({ title: "Bulk Delete Category 1" });
      const second = await categoryFactory.create({ title: "Bulk Delete Category 2" });
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      const response = await request(app.getHttpServer())
        .delete("/api/category/deleteManyCategories")
        .set("Cookie", await cookieFor(admin, app))
        .send([first.id, second.id])
        .expect(200);

      expect(response.body.data.message).toBe("Categories deleted successfully");
    });
  });
});
