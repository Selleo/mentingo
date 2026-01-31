import request from "supertest";

import { DB, DB_BASE } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";
import { DEFAULT_PAGE_SIZE } from "../../common/pagination";
import { certificates } from "../../storage/schema";
import { USER_ROLES } from "../../user/schemas/userRoles";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("CertificatesController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  const password = "password123";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_BASE);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  describe("GET /api/certificates/all", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).get("/api/certificates/all").expect(401);
      });
    });

    describe("when user is logged in", () => {
      it.only("returns certificates of specific user", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .withAdminRole()
          .create();

        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create();

        const cookies = await cookieFor(student, app);

        const category = await categoryFactory.create();

        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });

        await db.insert(certificates).values({
          userId: student.id,
          courseId: course.id,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/all")
          .set("Cookie", cookies)
          .query({ userId: student.id })
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBeDefined();
        expect(response.body.data[0].courseId).toBe(course.id);
        expect(response.body.data[0].courseTitle).toBe(course.title);
        expect(response.body.data[0].completionDate).toBe(null);
        expect(response.body.data[0].fullName).toBe(`${student.firstName} ${student.lastName}`);
        expect(response.body.data[0].userId).toBe(student.id);
        expect(response.body.pagination.totalItems).toBe(1);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.perPage).toBe(DEFAULT_PAGE_SIZE);
      });

      it("returns certificates of specific user with pagination", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course1 = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        const course2 = await courseFactory.create({
          title: "JavaScript Course",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course1.id,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course2.id,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/all")
          .set("Cookie", cookies)
          .query({ userId: student.id, perPage: 1, page: 2 })
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].courseId).toBe(course2.id);
      });

      it("returns certificates of specific user with sorting", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course1 = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        const course2 = await courseFactory.create({
          title: "JavaScript Course",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course2.id,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course1.id,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/all")
          .set("Cookie", cookies)
          .query({ userId: student.id, sort: "createdAt" })
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].courseId).toBe(course2.id);
        expect(response.body.data[1].courseId).toBe(course1.id);
      });
    });
  });

  describe("GET /api/cerfiticates/certificate", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).get("/api/certificates/certificate").expect(401);
      });
    });

    describe("when user is logged in", () => {
      it("returns specific certificate of specific user", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course.id,
        });

        const response = await request(app.getHttpServer())
          .get("/api/certificates/certificate")
          .set("Cookie", cookies)
          .query({ userId: student.id, courseId: course.id })
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].id).toBeDefined();
        expect(response.body[0].courseId).toBe(course.id);
        expect(response.body[0].courseTitle).toBe(course.title);
        expect(response.body[0].completionDate).toBe(null);
        expect(response.body[0].fullName).toBe(`${student.firstName} ${student.lastName}`);
        expect(response.body[0].userId).toBe(student.id);
      });

      it("returns 404 if certificate does not exist", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });

        await request(app.getHttpServer())
          .get("/api/certificates/certificate")
          .set("Cookie", cookies)
          .query({ userId: student.id, courseId: course.id })
          .expect(404);
      });
    });
  });

  describe("POST /api/certificates/download", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).post("/api/certificates/download").expect(401);
      });
    });

    describe("when user is logged in", () => {
      it("returns pdf file", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course.id,
        });

        const html = `test`;
        const response = await request(app.getHttpServer())
          .post("/api/certificates/download")
          .set("Cookie", cookies)
          .send({ html })
          .expect(201);

        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.headers["content-disposition"]).toBe(
          'attachment; filename="certificate.pdf"',
        );
        expect(response.body instanceof Buffer).toBe(true);
      });

      it("returns pdf file with custom filename", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          title: "Python Basics",
          authorId: admin.id,
          categoryId: category.id,
          thumbnailS3Key: null,
          hasCertificate: true,
        });
        await db.insert(certificates).values({
          userId: student.id,
          courseId: course.id,
        });

        const html = `test`;
        const filename = "test.pdf";
        const response = await request(app.getHttpServer())
          .post("/api/certificates/download")
          .set("Cookie", cookies)
          .send({ html, filename })
          .expect(201);

        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.headers["content-disposition"]).toBe(`attachment; filename="${filename}"`);
        expect(response.body instanceof Buffer).toBe(true);
      });
    });
  });
});
