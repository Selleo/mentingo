import { JwtService } from "@nestjs/jwt";
import { COURSE_ENROLLMENT, PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { isNull, sql } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  courseDiscussionComments,
  chapters,
  courseDiscussionThreads,
  lessons,
  settings,
  studentCourses,
} from "src/storage/schema";

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

  const createLesson = async (courseId: string, authorId: string) => {
    const [chapter] = await db
      .insert(chapters)
      .values({
        title: { en: "Chapter" },
        courseId,
        authorId,
        isFreemium: false,
        displayOrder: 1,
        lessonCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    const [lesson] = await db
      .insert(lessons)
      .values({
        chapterId: chapter.id,
        type: "content",
        title: { en: "Lesson" },
        description: { en: "Description" },
        displayOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return { chapter, lesson };
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
      .send({ title: "  Hello  ", content: "  World  " })
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

  it("admin can hide and unhide thread", async () => {
    await enableCohortLearning(true);
    const admin = await userFactory
      .withCredentials({ password: "password123" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const course = await courseFactory.create({ authorId: admin.id });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: admin.id,
        title: "Title",
        content: "Body",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const cookies = authCookies(admin, SYSTEM_ROLE_SLUGS.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/discussions/${thread.id}/moderation`)
      .set("Cookie", cookies)
      .send({ hidden: true })
      .expect(200);
    let row = await db
      .select()
      .from(courseDiscussionThreads)
      .where(sql`${courseDiscussionThreads.id} = ${thread.id}`);
    expect(row[0].status).toBe("hidden_by_staff");
    expect(row[0].hiddenById).toBe(admin.id);
    await request(app.getHttpServer())
      .patch(`/api/discussions/${thread.id}/moderation`)
      .set("Cookie", cookies)
      .send({ hidden: false })
      .expect(200);
    row = await db
      .select()
      .from(courseDiscussionThreads)
      .where(sql`${courseDiscussionThreads.id} = ${thread.id}`);
    expect(row[0].status).toBe("visible");
    expect(row[0].hiddenAt).toBeNull();
  });

  it("course author can hide and unhide thread in own course", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withContentCreatorSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
    const course = await courseFactory.create({ authorId: author.id });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "Title",
        content: "Body",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const cookies = authCookies(author, SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    await request(app.getHttpServer())
      .patch(`/api/discussions/${thread.id}/moderation`)
      .set("Cookie", cookies)
      .send({ hidden: true })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/discussions/${thread.id}/moderation`)
      .set("Cookie", cookies)
      .send({ hidden: false })
      .expect(200);
  });

  it("non-staff enrolled student cannot moderate thread", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "Title",
        content: "Body",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await request(app.getHttpServer())
      .patch(`/api/discussions/${thread.id}/moderation`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .send({ hidden: true })
      .expect(403);
  });

  it("moderation forbidden when switch off", async () => {
    await enableCohortLearning(false);
    const admin = await userFactory
      .withCredentials({ password: "password123" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const course = await courseFactory.create({ authorId: admin.id });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: admin.id,
        title: "Title",
        content: "Body",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await request(app.getHttpServer())
      .patch(`/api/discussions/${thread.id}/moderation`)
      .set("Cookie", authCookies(admin, SYSTEM_ROLE_SLUGS.ADMIN))
      .send({ hidden: true })
      .expect(403);
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

  it("authorized user can get thread detail with comments sorted ASC", async () => {
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
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: student.id,
        title: "Thread",
        content: "Body",
        status: "visible",
        lastActivityAt: "2024-01-02T00:00:00.000Z",
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      })
      .returning();
    await db.insert(courseDiscussionComments).values([
      {
        threadId: thread.id,
        authorId: student.id,
        content: "B",
        status: "visible",
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      },
      {
        threadId: thread.id,
        authorId: student.id,
        content: "A",
        status: "visible",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
    const res = await request(app.getHttpServer())
      .get(`/api/discussions/${thread.id}`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(res.body.data.comments.map((c: any) => c.content)).toEqual(["A", "B"]);
  });

  it("student detail and list get placeholders for hidden content", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    for (const u of [author, student])
      await db.insert(studentCourses).values({
        studentId: u.id,
        courseId: course.id,
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "Secret",
        content: "Secret body",
        status: "hidden_by_staff",
        hiddenAt: new Date().toISOString(),
        hiddenById: author.id,
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await db.insert(courseDiscussionComments).values({
      threadId: thread.id,
      authorId: author.id,
      content: "Hidden comment",
      status: "hidden_by_staff",
      hiddenAt: new Date().toISOString(),
      hiddenById: author.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const detail = await request(app.getHttpServer())
      .get(`/api/discussions/${thread.id}`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(detail.body.data.title).toBe("Comment unavailable");
    expect(detail.body.data.content).toBe("This content is unavailable.");
    expect(detail.body.data.comments[0].content).toBe("This content is unavailable.");
    const list = await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/discussions`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(list.body.data[0].title).toBe("Comment unavailable");
  });

  it("student detail gets placeholder for hidden comment", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    for (const u of [author, student])
      await db.insert(studentCourses).values({
        studentId: u.id,
        courseId: course.id,
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "Visible",
        content: "Visible",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await db.insert(courseDiscussionComments).values({
      threadId: thread.id,
      authorId: author.id,
      content: "Hidden comment",
      status: "hidden_by_staff",
      hiddenAt: new Date().toISOString(),
      hiddenById: author.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const detail = await request(app.getHttpServer())
      .get(`/api/discussions/${thread.id}`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(detail.body.data.comments[0].content).toBe("This content is unavailable.");
  });

  it("moderator sees original hidden content", async () => {
    await enableCohortLearning(true);
    const admin = await userFactory
      .withCredentials({ password: "password123" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const course = await courseFactory.create({ authorId: admin.id });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: admin.id,
        title: "Secret",
        content: "Secret body",
        status: "hidden_by_staff",
        hiddenAt: new Date().toISOString(),
        hiddenById: admin.id,
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const detail = await request(app.getHttpServer())
      .get(`/api/discussions/${thread.id}`)
      .set("Cookie", authCookies(admin, SYSTEM_ROLE_SLUGS.ADMIN))
      .expect(200);
    expect(detail.body.data.title).toBe("Secret");
  });

  it("moderation on deleted_by_author content is rejected", async () => {
    await enableCohortLearning(true);
    const admin = await userFactory
      .withCredentials({ password: "password123" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const course = await courseFactory.create({ authorId: admin.id });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: admin.id,
        title: "Title",
        content: "Body",
        status: "deleted_by_author",
        deletedAt: new Date().toISOString(),
        deletedById: admin.id,
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await request(app.getHttpServer())
      .patch(`/api/discussions/${thread.id}/moderation`)
      .set("Cookie", authCookies(admin, SYSTEM_ROLE_SLUGS.ADMIN))
      .send({ hidden: true })
      .expect(409);
  });

  it("authorized user denied when switch off", async () => {
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
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: student.id,
        title: "Thread",
        content: "Body",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await request(app.getHttpServer())
      .get(`/api/discussions/${thread.id}`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(403);
  });

  it("author can edit own thread and non-author cannot", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const other = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    for (const u of [author, other])
      await db.insert(studentCourses).values({
        studentId: u.id,
        courseId: course.id,
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "Old",
        content: "Old",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await request(app.getHttpServer())
      .patch(`/api/discussions/${thread.id}`)
      .set("Cookie", authCookies(author, SYSTEM_ROLE_SLUGS.STUDENT))
      .send({ title: "New" })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/discussions/${thread.id}`)
      .set("Cookie", authCookies(other, SYSTEM_ROLE_SLUGS.STUDENT))
      .send({ title: "Bad" })
      .expect(403);
  });

  it("author soft-deletes thread", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    await db.insert(studentCourses).values({
      studentId: author.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "Old",
        content: "Old",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const res = await request(app.getHttpServer())
      .delete(`/api/discussions/${thread.id}`)
      .set("Cookie", authCookies(author, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(res.body.data.status).toBe("deleted_by_author");
  });

  it("author can add comment and parent lastActivityAt changes", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    await db.insert(studentCourses).values({
      studentId: author.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "Old",
        content: "Old",
        status: "visible",
        lastActivityAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      })
      .returning();
    const res = await request(app.getHttpServer())
      .post(`/api/discussions/${thread.id}/comments`)
      .set("Cookie", authCookies(author, SYSTEM_ROLE_SLUGS.STUDENT))
      .send({ content: "Hi" })
      .expect(201);
    expect(res.body.data.content).toBe("Hi");
    const updated = await db
      .select()
      .from(courseDiscussionThreads)
      .where(sql`${courseDiscussionThreads.id} = ${thread.id}`);
    expect(updated[0].lastActivityAt).not.toBe("2024-01-01T00:00:00.000Z");
  });

  it("author can edit own comment and non-author cannot", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const other = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    for (const u of [author, other])
      await db.insert(studentCourses).values({
        studentId: u.id,
        courseId: course.id,
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "T",
        content: "C",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const [comment] = await db
      .insert(courseDiscussionComments)
      .values({
        threadId: thread.id,
        authorId: author.id,
        content: "Old",
        status: "visible",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await request(app.getHttpServer())
      .patch(`/api/discussion-comments/${comment.id}`)
      .set("Cookie", authCookies(author, SYSTEM_ROLE_SLUGS.STUDENT))
      .send({ content: "New" })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/discussion-comments/${comment.id}`)
      .set("Cookie", authCookies(other, SYSTEM_ROLE_SLUGS.STUDENT))
      .send({ content: "Bad" })
      .expect(403);
  });

  it("author soft-deletes own comment", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    await db.insert(studentCourses).values({
      studentId: author.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "T",
        content: "C",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const [comment] = await db
      .insert(courseDiscussionComments)
      .values({
        threadId: thread.id,
        authorId: author.id,
        content: "Old",
        status: "visible",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const res = await request(app.getHttpServer())
      .delete(`/api/discussion-comments/${comment.id}`)
      .set("Cookie", authCookies(author, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(res.body.data.status).toBe("deleted_by_author");
  });

  it("admin can hide and unhide comment", async () => {
    await enableCohortLearning(true);
    const admin = await userFactory
      .withCredentials({ password: "password123" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const course = await courseFactory.create({ authorId: admin.id });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: admin.id,
        title: "T",
        content: "C",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const [comment] = await db
      .insert(courseDiscussionComments)
      .values({
        threadId: thread.id,
        authorId: admin.id,
        content: "Comment",
        status: "visible",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const cookies = authCookies(admin, SYSTEM_ROLE_SLUGS.ADMIN);
    await request(app.getHttpServer())
      .patch(`/api/discussion-comments/${comment.id}/moderation`)
      .set("Cookie", cookies)
      .send({ hidden: true })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/discussion-comments/${comment.id}/moderation`)
      .set("Cookie", cookies)
      .send({ hidden: false })
      .expect(200);
  });

  it("non-staff cannot moderate comment", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "T",
        content: "C",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    const [comment] = await db
      .insert(courseDiscussionComments)
      .values({
        threadId: thread.id,
        authorId: author.id,
        content: "Comment",
        status: "visible",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await request(app.getHttpServer())
      .patch(`/api/discussion-comments/${comment.id}/moderation`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .send({ hidden: true })
      .expect(403);
  });

  it("unauthorized or unenrolled cannot read thread detail", async () => {
    await enableCohortLearning(true);
    const author = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({ authorId: author.id });
    const [thread] = await db
      .insert(courseDiscussionThreads)
      .values({
        courseId: course.id,
        lessonId: null,
        authorId: author.id,
        title: "T",
        content: "C",
        status: "visible",
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await request(app.getHttpServer())
      .get(`/api/discussions/${thread.id}`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(403);
    await request(app.getHttpServer()).get(`/api/discussions/${thread.id}`).expect(401);
  });

  it("enrolled student can list empty lesson discussions", async () => {
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
    const { lesson } = await createLesson(course.id, student.id);
    const res = await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(res.body.data).toEqual([]);
  });

  it("enrolled student can create lesson discussion", async () => {
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
    const { lesson } = await createLesson(course.id, student.id);
    const res = await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .send({ title: "  Hello\u0000 ", content: "  World\u0000  " })
      .expect(201);
    expect(res.body.data.lessonId).toBe(lesson.id);
  });

  it("admin can list/create lesson discussions", async () => {
    await enableCohortLearning(true);
    const admin = await userFactory
      .withCredentials({ password: "password123" })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const course = await courseFactory.create({ authorId: admin.id });
    const { lesson } = await createLesson(course.id, admin.id);
    const cookies = authCookies(admin, SYSTEM_ROLE_SLUGS.ADMIN);
    await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", cookies)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", cookies)
      .send({ title: "Title", content: "Content" })
      .expect(201);
  });

  it("course author can list/create lesson discussions", async () => {
    await enableCohortLearning(true);
    const creator = await userFactory
      .withCredentials({ password: "password123" })
      .withContentCreatorSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
    const course = await courseFactory.create({ authorId: creator.id });
    const { lesson } = await createLesson(course.id, creator.id);
    const cookies = authCookies(creator, SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", cookies)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", cookies)
      .send({ title: "Title", content: "Content" })
      .expect(201);
  });

  it("lesson discussions do not mix with course-level threads", async () => {
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
    const { lesson } = await createLesson(course.id, student.id);
    await db.insert(courseDiscussionThreads).values({
      courseId: course.id,
      lessonId: null,
      authorId: student.id,
      title: "Course",
      content: "Course",
      status: "visible",
      lastActivityAt: "2024-01-02T00:00:00.000Z",
      createdAt: "2024-01-02T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    });
    await db.insert(courseDiscussionThreads).values({
      courseId: course.id,
      lessonId: lesson.id,
      authorId: student.id,
      title: "Lesson",
      content: "Lesson",
      status: "visible",
      lastActivityAt: "2024-01-03T00:00:00.000Z",
      createdAt: "2024-01-03T00:00:00.000Z",
      updatedAt: "2024-01-03T00:00:00.000Z",
    });
    const res = await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe("Lesson");
  });

  it("lesson discussions from another lesson do not mix", async () => {
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
    const { lesson: lesson1 } = await createLesson(course.id, student.id);
    const { lesson: lesson2 } = await createLesson(course.id, student.id);
    await db.insert(courseDiscussionThreads).values({
      courseId: course.id,
      lessonId: lesson1.id,
      authorId: student.id,
      title: "L1",
      content: "L1",
      status: "visible",
      lastActivityAt: "2024-01-03T00:00:00.000Z",
      createdAt: "2024-01-03T00:00:00.000Z",
      updatedAt: "2024-01-03T00:00:00.000Z",
    });
    const res = await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/lessons/${lesson2.id}/discussions`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(200);
    expect(res.body.data).toEqual([]);
  });

  it("lesson not belonging to course returns 404", async () => {
    await enableCohortLearning(true);
    const student = await userFactory
      .withCredentials({ password: "password123" })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course1 = await courseFactory.create({ authorId: student.id });
    const course2 = await courseFactory.create({ authorId: student.id });
    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course1.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const { lesson } = await createLesson(course2.id, student.id);
    await request(app.getHttpServer())
      .get(`/api/courses/${course1.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT))
      .expect(404);
  });

  it("unenrolled student gets 403 on lesson GET and POST", async () => {
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
    const { lesson } = await createLesson(course.id, author.id);
    const cookies = authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT);
    await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", cookies)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", cookies)
      .send({ title: "Title", content: "Content" })
      .expect(403);
  });

  it("global switch off lesson GET and POST returns 403", async () => {
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
    const { lesson } = await createLesson(course.id, student.id);
    const cookies = authCookies(student, SYSTEM_ROLE_SLUGS.STUDENT);
    await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", cookies)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/lessons/${lesson.id}/discussions`)
      .set("Cookie", cookies)
      .send({ title: "Title", content: "Content" })
      .expect(403);
  });
});
