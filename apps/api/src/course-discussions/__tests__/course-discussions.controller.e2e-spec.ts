import { JwtService } from "@nestjs/jwt";
import { COURSE_ENROLLMENT, PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { isNull, sql } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courseDiscussionThreads, settings, studentCourses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("CourseDiscussionsController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let jwtService: JwtService;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;

  const authCookies = (user: { id: string; email: string; tenantId: string }, roleSlug: string) => {
    const token = jwtService.sign({
      userId: user.id,
      email: user.email,
      roleSlugs: [roleSlug],
      permissions: Object.values(PERMISSIONS),
      tenantId: user.tenantId,
    });
    return [`access_token=${token};`];
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    jwtService = app.get(JwtService);
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  const enableCohortLearning = async (value: boolean) => {
    await db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{cohortLearningEnabled}',
            to_jsonb(${value}::boolean),
            true
          )
        `,
      })
      .where(isNull(settings.userId));
  };

  it("enrolled student can list empty course discussions", async () => {
    await enableCohortLearning(true);
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: student.id });
    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/discussions`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(res.body.data).toEqual([]);
  });

  it("enrolled student can create course discussion", async () => {
    await enableCohortLearning(true);
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: student.id });
    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/discussions`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .send({ title: "  Hello\u0000 ", content: "  World\u0000  " })
      .expect(201);
    expect(res.body.data.title).toBe("Hello");
    expect(res.body.data.content).toBe("World");
    expect(res.body.data.lessonId).toBeNull();
  });

  it("admin can list/create course discussions", async () => {
    await enableCohortLearning(true);
    const admin = await userFactory
      .withCredentials({ password: "password123" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const course = await courseFactory.create({ authorId: admin.id });
    const cookies = authCookies(admin, SYSTEM_ROLE_SLUGS.ADMIN);

    await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/discussions`)
      .set("Cookie", cookies)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/discussions`)
      .set("Cookie", cookies)
      .send({ title: "Title", content: "Content" })
      .expect(201);
  });

  it("course author can list/create own course discussions", async () => {
    await enableCohortLearning(true);
    const creator = await userFactory
      .withCredentials({ password: "password123" })
      .withContentCreatorSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
    const course = await courseFactory.create({ authorId: creator.id });
    const cookies = authCookies(creator, SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);

    await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/discussions`)
      .set("Cookie", cookies)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/discussions`)
      .set("Cookie", cookies)
      .send({ title: "Title", content: "Content" })
      .expect(201);
  });

  it("unenrolled student gets 403 on GET and POST", async () => {
    await enableCohortLearning(true);
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withContentCreatorSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
    const course = await courseFactory.create({ authorId: author.id });
    const cookies = authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT);
    await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/discussions`)
      .set("Cookie", cookies)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/discussions`)
      .set("Cookie", cookies)
      .send({ title: "Title", content: "Content" })
      .expect(403);
  });

  it("when global switch off enrolled student gets 403", async () => {
    await enableCohortLearning(false);
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: student.id });
    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const cookies = authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT);
    await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/discussions`)
      .set("Cookie", cookies)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/discussions`)
      .set("Cookie", cookies)
      .send({ title: "Title", content: "Content" })
      .expect(403);
  });

  it("GET returns threads sorted by lastActivityAt DESC", async () => {
    await enableCohortLearning(true);
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: student.id });
    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const cookies = authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT);
    await db.insert(courseDiscussionThreads).values([
      {
        courseId: course.id,
        lessonId: null,
        authorId: student.id,
        title: "Old",
        content: "Old",
        status: "visible",
        lastActivityAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        courseId: course.id,
        lessonId: null,
        authorId: student.id,
        title: "New",
        content: "New",
        status: "visible",
        lastActivityAt: "2024-01-02T00:00:00.000Z",
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      },
    ]);
    const res = await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/discussions`)
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.data.map((t: any) => t.title)).toEqual(["New", "Old"]);
  });

  it("unauthenticated gets 401", async () => {
    await request(app.getHttpServer())
      .get("/api/courses/00000000-0000-0000-0000-000000000000/discussions")
      .expect(401);
  });
});
