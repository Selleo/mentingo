import { randomUUID } from "node:crypto";

import { COURSE_ENROLLMENT, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_SEQUENCE_ENABLED, QUIZ_FEEDBACK_ENABLED } from "src/courses/constants";
import { RATE_LIMITS } from "src/rate-limit/rate-limit.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  categories,
  certificates,
  chapters,
  courses,
  integrationApiKeys,
  lessons,
  studentCourses,
  studentLessonProgress,
  tenants,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("IntegrationController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;

  const password = "Password123@@";
  const uniqueTenantHost = (prefix: string) => `https://${prefix}-${randomUUID()}.local`;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();

    app = testApp;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    groupFactory = createGroupFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });

  describe("integration key management", () => {
    it("returns 401 for rotate key when user is not authenticated", async () => {
      await request(app.getHttpServer()).post("/api/integration/key").expect(401);
    });

    it("returns null current key for admin before first key generation", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      const response = await request(app.getHttpServer())
        .get("/api/integration/key")
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data.key).toBeNull();
    });

    it("generates raw key once and stores only hash/prefix in database", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      const response = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);

      const rawKey = response.body.data.key as string;
      expect(rawKey).toMatch(/^itgk_[A-Za-z0-9_-]+$/);
      expect(response.body.data.metadata.keyPrefix).toBe(rawKey.slice(0, 16));

      const [storedKey] = await db
        .select()
        .from(integrationApiKeys)
        .where(
          and(
            eq(integrationApiKeys.createdByUserId, admin.id),
            isNull(integrationApiKeys.revokedAt),
          ),
        )
        .limit(1);

      expect(storedKey).toBeDefined();
      expect(storedKey.keyPrefix).toBe(rawKey.slice(0, 16));
      expect(storedKey.keyHash).toHaveLength(64);
      expect(storedKey.keyHash).not.toBe(rawKey);
    });

    it("returns 429 on integration key rotation request above configured write limit", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      for (
        let attempt = 1;
        attempt <= RATE_LIMITS.INTEGRATION_WRITE_REQUESTS_PER_MINUTE;
        attempt += 1
      ) {
        await request(app.getHttpServer())
          .post("/api/integration/key")
          .set("Cookie", cookies)
          .expect(201);
      }

      await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(429);
    });
  });

  describe("integration groups endpoint", () => {
    it("returns 401 when X-API-Key header is missing", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .expect(401);

      expect(response.body.message).toBe("integrationApiKey.errors.missingApiKeyHeader");
    });

    it("returns paginated groups for valid key", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);
      const group = await groupFactory.create();

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);

      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .expect(200);

      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: group.id,
            name: group.name,
          }),
        ]),
      );
      expect(response.body.pagination.totalItems).toBeGreaterThanOrEqual(1);
    });

    it("returns 401 when X-Tenant-Id header is missing for non-tenant-list endpoint", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", apiKey)
        .expect(401);

      expect(response.body.message).toBe("integrationApiKey.errors.missingTenantIdHeader");
    });

    it("rejects old key after rotation override", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      const firstRotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const oldKey = firstRotateResponse.body.data.key as string;

      await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", oldKey)
        .set("X-Tenant-Id", admin.tenantId)
        .expect(401);

      expect(response.body.message).toBe("integrationApiKey.errors.invalidApiKey");
    });

    it("returns only own tenant for non-managing admin", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      await dbAdmin
        .update(tenants)
        .set({ isManaging: false })
        .where(eq(tenants.id, admin.tenantId));

      await dbAdmin.insert(tenants).values({
        name: "Another Tenant",
        host: uniqueTenantHost("another-tenant"),
      });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/tenants")
        .set("X-API-Key", apiKey)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toEqual(
        expect.objectContaining({
          id: admin.tenantId,
          name: expect.any(String),
          host: expect.any(String),
        }),
      );
    });

    it("returns all tenants for managing admin", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      await dbAdmin.update(tenants).set({ isManaging: true }).where(eq(tenants.id, admin.tenantId));

      await dbAdmin.insert(tenants).values({
        name: "Selectable Tenant",
        host: uniqueTenantHost("selectable-tenant"),
      });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/tenants")
        .set("X-API-Key", apiKey)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(1);
    });

    it("returns 403 when non-managing admin uses another tenant id", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      await dbAdmin
        .update(tenants)
        .set({ isManaging: false })
        .where(eq(tenants.id, admin.tenantId));

      const [{ id: otherTenantId }] = await dbAdmin
        .insert(tenants)
        .values({
          name: "Other Tenant",
          host: uniqueTenantHost("other-tenant"),
        })
        .returning({ id: tenants.id });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", otherTenantId)
        .expect(403);

      expect(response.body.message).toBe("integrationApiKey.errors.crossTenantAccessForbidden");
    });

    it("allows managing admin to use another tenant id", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      await dbAdmin.update(tenants).set({ isManaging: true }).where(eq(tenants.id, admin.tenantId));

      const [{ id: otherTenantId }] = await dbAdmin
        .insert(tenants)
        .values({
          name: "Managed Target Tenant",
          host: uniqueTenantHost("managed-target-tenant"),
        })
        .returning({ id: tenants.id });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", otherTenantId)
        .expect(200);
    });
  });

  describe("integration training results endpoint", () => {
    it("returns per-student-per-course rows with scope-based filtering", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      const [studentOne, studentTwo] = await Promise.all([
        userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT, tenantId: admin.tenantId }),
        userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT, tenantId: admin.tenantId }),
      ]);

      const chapterId = randomUUID();
      const categoryId = randomUUID();
      const courseId = randomUUID();
      const lessonOneId = randomUUID();
      const lessonTwoId = randomUUID();
      const now = new Date().toISOString();
      const categoryTitle = `Integration category ${randomUUID()}`;

      await db.insert(categories).values({
        id: categoryId,
        title: categoryTitle,
        tenantId: admin.tenantId,
      });

      await db.insert(courses).values({
        id: courseId,
        title: { en: "Integration course" },
        description: {},
        status: "published",
        hasCertificate: true,
        authorId: admin.id,
        categoryId,
        settings: {
          lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
          quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
          certificateSignature: null,
          certificateFontColor: null,
        },
        tenantId: admin.tenantId,
      });

      await db.insert(chapters).values({
        id: chapterId,
        title: {},
        courseId,
        authorId: admin.id,
        isFreemium: false,
        displayOrder: 1,
        lessonCount: 2,
        tenantId: admin.tenantId,
      });

      await db.insert(lessons).values([
        {
          id: lessonOneId,
          chapterId,
          type: "quiz",
          title: { en: "Quiz lesson" },
          thresholdScore: 50,
          displayOrder: 1,
          tenantId: admin.tenantId,
        },
        {
          id: lessonTwoId,
          chapterId,
          type: "text",
          title: { en: "Text lesson" },
          displayOrder: 2,
          tenantId: admin.tenantId,
        },
      ]);

      await db.insert(studentCourses).values([
        {
          studentId: studentOne.id,
          courseId,
          status: COURSE_ENROLLMENT.ENROLLED,
          tenantId: admin.tenantId,
        },
        {
          studentId: studentTwo.id,
          courseId,
          status: COURSE_ENROLLMENT.ENROLLED,
          tenantId: admin.tenantId,
        },
      ]);

      await db.insert(studentLessonProgress).values([
        {
          studentId: studentOne.id,
          chapterId,
          lessonId: lessonOneId,
          quizScore: 80,
          attempts: 1,
          isQuizPassed: true,
          completedQuestionCount: 1,
          completedAt: now,
          tenantId: admin.tenantId,
        },
        {
          studentId: studentTwo.id,
          chapterId,
          lessonId: lessonOneId,
          quizScore: 40,
          attempts: 2,
          isQuizPassed: false,
          completedQuestionCount: 1,
          completedAt: now,
          tenantId: admin.tenantId,
        },
        {
          studentId: studentTwo.id,
          chapterId,
          lessonId: lessonTwoId,
          completedQuestionCount: 1,
          completedAt: now,
          tenantId: admin.tenantId,
        },
      ]);

      await db.insert(certificates).values({
        userId: studentOne.id,
        courseId,
        tenantId: admin.tenantId,
      });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);

      const apiKey = rotateResponse.body.data.key as string;

      const tenantResponse = await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "tenant" })
        .expect(200);

      expect(tenantResponse.body.data).toHaveLength(2);
      expect(tenantResponse.body.pagination).toEqual({
        totalItems: 2,
        page: 1,
        perPage: 20,
      });
      const tenantStudentOneRow = tenantResponse.body.data.find(
        (row: { student: { id: string }; courses: { id: string }[] }) =>
          row.student.id === studentOne.id && row.courses.some((course) => course.id === courseId),
      );
      const tenantStudentTwoRow = tenantResponse.body.data.find(
        (row: { student: { id: string }; courses: { id: string }[] }) =>
          row.student.id === studentTwo.id && row.courses.some((course) => course.id === courseId),
      );

      expect(tenantStudentOneRow).toEqual(
        expect.objectContaining({
          scope: "tenant",
          tenantId: admin.tenantId,
          student: expect.objectContaining({
            id: studentOne.id,
            email: studentOne.email,
          }),
          courses: [
            expect.objectContaining({
              id: courseId,
              title: expect.any(String),
              certificate: {
                enabled: true,
                status: "issued",
                issuedAt: expect.any(String),
              },
            }),
          ],
        }),
      );
      expect(tenantStudentOneRow.courses[0].lessons).toEqual([
        {
          lessonId: lessonOneId,
          chapterId,
          title: expect.any(String),
          type: "quiz",
          completed: true,
          completedAt: expect.any(String),
        },
        {
          lessonId: lessonTwoId,
          chapterId,
          title: expect.any(String),
          type: "text",
          completed: false,
          completedAt: null,
        },
      ]);
      expect(tenantStudentOneRow.courses[0].quizzes).toEqual([
        {
          lessonId: lessonOneId,
          chapterId,
          title: expect.any(String),
          score: 80,
          passed: true,
          attempts: 1,
          completedAt: expect.any(String),
        },
      ]);

      expect(tenantStudentTwoRow).toEqual(
        expect.objectContaining({
          scope: "tenant",
          tenantId: admin.tenantId,
          student: expect.objectContaining({
            id: studentTwo.id,
            email: studentTwo.email,
          }),
          courses: [
            expect.objectContaining({
              id: courseId,
              title: expect.any(String),
              certificate: {
                enabled: true,
                status: "not_issued",
                issuedAt: null,
              },
            }),
          ],
        }),
      );
      expect(tenantStudentTwoRow.courses[0].lessons).toEqual([
        {
          lessonId: lessonOneId,
          chapterId,
          title: expect.any(String),
          type: "quiz",
          completed: true,
          completedAt: expect.any(String),
        },
        {
          lessonId: lessonTwoId,
          chapterId,
          title: expect.any(String),
          type: "text",
          completed: true,
          completedAt: expect.any(String),
        },
      ]);
      expect(tenantStudentTwoRow.courses[0].quizzes).toEqual([
        {
          lessonId: lessonOneId,
          chapterId,
          title: expect.any(String),
          score: 40,
          passed: false,
          attempts: 2,
          completedAt: expect.any(String),
        },
      ]);
      const paginatedTenantResponse = await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "tenant", page: 2, perPage: 1 })
        .expect(200);

      expect(paginatedTenantResponse.body.data).toHaveLength(1);
      expect(paginatedTenantResponse.body.pagination).toEqual({
        totalItems: 2,
        page: 2,
        perPage: 1,
      });

      const tenantStudentFilterResponse = await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "tenant", studentId: studentOne.id })
        .expect(200);

      expect(tenantStudentFilterResponse.body.data).toHaveLength(1);
      expect(tenantStudentFilterResponse.body.pagination).toEqual({
        totalItems: 1,
        page: 1,
        perPage: 20,
      });

      const studentResponse = await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "student", studentId: studentOne.id })
        .expect(200);

      expect(studentResponse.body.data).toHaveLength(1);
      expect(studentResponse.body.data[0]).toEqual(
        expect.objectContaining({
          scope: "student",
          tenantId: admin.tenantId,
          student: expect.objectContaining({ id: studentOne.id }),
          courses: [
            expect.objectContaining({
              id: courseId,
              certificate: expect.objectContaining({ status: "issued" }),
            }),
          ],
        }),
      );

      const courseResponse = await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "course", courseId })
        .expect(200);

      expect(courseResponse.body.data).toHaveLength(2);
      const courseStudentOneRow = courseResponse.body.data.find(
        (row: { student: { id: string } }) => row.student.id === studentOne.id,
      );
      const courseStudentTwoRow = courseResponse.body.data.find(
        (row: { student: { id: string } }) => row.student.id === studentTwo.id,
      );

      expect(courseStudentOneRow).toEqual(
        expect.objectContaining({
          scope: "course",
          tenantId: admin.tenantId,
          student: expect.objectContaining({ id: studentOne.id }),
          courses: [
            expect.objectContaining({
              id: courseId,
              certificate: expect.objectContaining({ status: "issued" }),
            }),
          ],
        }),
      );

      expect(courseStudentTwoRow).toEqual(
        expect.objectContaining({
          scope: "course",
          tenantId: admin.tenantId,
          student: expect.objectContaining({ id: studentTwo.id }),
          courses: [
            expect.objectContaining({
              id: courseId,
              certificate: expect.objectContaining({ status: "not_issued" }),
            }),
          ],
        }),
      );

      const courseStudentFilterResponse = await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "course", courseId, studentId: studentOne.id })
        .expect(200);

      expect(courseStudentFilterResponse.body.data).toHaveLength(1);
      expect(courseStudentFilterResponse.body.data[0]).toEqual(
        expect.objectContaining({
          scope: "course",
          tenantId: admin.tenantId,
          student: expect.objectContaining({ id: studentOne.id }),
          courses: [expect.objectContaining({ id: courseId })],
        }),
      );

      const courseStudentTwoFilterResponse = await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "student", studentId: studentTwo.id, courseId })
        .expect(200);

      expect(courseStudentTwoFilterResponse.body.data).toHaveLength(1);
      expect(courseStudentTwoFilterResponse.body.data[0]).toEqual(
        expect.objectContaining({
          scope: "student",
          tenantId: admin.tenantId,
          student: expect.objectContaining({ id: studentTwo.id }),
          courses: [expect.objectContaining({ id: courseId })],
        }),
      );
    });

    it("returns 400 when scope-specific required filter is missing", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);

      const apiKey = rotateResponse.body.data.key as string;

      await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "student" })
        .expect(400);

      await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "course" })
        .expect(400);
    });

    it("returns not_applicable certificate status when course certificates are disabled", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
      const cookies = await cookieFor(admin, app);
      const student = await userFactory.create({
        role: SYSTEM_ROLE_SLUGS.STUDENT,
        tenantId: admin.tenantId,
      });

      const chapterId = randomUUID();
      const categoryId = randomUUID();
      const courseId = randomUUID();
      const lessonId = randomUUID();

      const categoryTitle = `Integration category ${randomUUID()}`;

      await db.insert(categories).values({
        id: categoryId,
        title: categoryTitle,
        tenantId: admin.tenantId,
      });

      await db.insert(courses).values({
        id: courseId,
        title: { en: "No certificate course" },
        description: {},
        status: "published",
        hasCertificate: false,
        authorId: admin.id,
        categoryId,
        settings: {
          lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
          quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
          certificateSignature: null,
          certificateFontColor: null,
        },
        tenantId: admin.tenantId,
      });

      await db.insert(chapters).values({
        id: chapterId,
        title: {},
        courseId,
        authorId: admin.id,
        isFreemium: false,
        displayOrder: 1,
        lessonCount: 1,
        tenantId: admin.tenantId,
      });

      await db.insert(lessons).values({
        id: lessonId,
        chapterId,
        type: "text",
        title: buildJsonbField("en", "Text lesson"),
        displayOrder: 1,
        tenantId: admin.tenantId,
      });

      await db.insert(studentCourses).values({
        studentId: student.id,
        courseId,
        status: COURSE_ENROLLMENT.ENROLLED,
        tenantId: admin.tenantId,
      });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);

      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/training-results")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .query({ scope: "course", courseId })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toEqual(
        expect.objectContaining({
          courses: [
            expect.objectContaining({
              certificate: {
                enabled: false,
                status: "not_applicable",
                issuedAt: null,
              },
              quizzes: [],
            }),
          ],
        }),
      );
      expect(response.body.data[0].courses[0].lessons).toEqual([
        {
          lessonId,
          chapterId,
          title: "Text lesson",
          type: "text",
          completed: false,
          completedAt: null,
        },
      ]);
    });
  });
});
