import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courseComments, studentCourses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("CourseCommentsController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;

  const password = "Password123!";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
  });

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  const enroll = async (studentId: string, courseId: string) => {
    await db.insert(studentCourses).values({
      studentId,
      courseId,
      status: "enrolled",
    });
  };

  const setupStudent = async () => {
    const user = await userFactory.withCredentials({ password }).withUserSettings(db).create();
    const cookie = await cookieFor(user, app);
    return { user, cookie };
  };

  const setupAdmin = async () => {
    const user = await userFactory.withCredentials({ password }).withAdminSettings(db).create();
    const cookie = await cookieFor(user, app);
    return { user, cookie };
  };

  const createCourseFor = async (authorId: string) => {
    return courseFactory.create({ authorId });
  };

  describe("POST /courses/:courseId/comments", () => {
    it("allows enrolled student to create a top-level comment (201)", async () => {
      const author = await userFactory.create();
      const course = await createCourseFor(author.id);
      const { user, cookie } = await setupStudent();
      await enroll(user.id, course.id);

      const response = await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/comments`)
        .set("Cookie", cookie)
        .send({ content: "Hello cohort" });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        content: "Hello cohort",
        parentCommentId: null,
        replyCount: 0,
        isDeleted: false,
      });
    });

    it("rejects non-enrolled user (403)", async () => {
      const author = await userFactory.create();
      const course = await createCourseFor(author.id);
      const { cookie } = await setupStudent();

      const response = await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/comments`)
        .set("Cookie", cookie)
        .send({ content: "I am not enrolled" });

      expect(response.status).toBe(403);
    });

    it("enforces depth=1 — replies to a reply are rejected (400)", async () => {
      const author = await userFactory.create();
      const course = await createCourseFor(author.id);
      const { user, cookie } = await setupStudent();
      await enroll(user.id, course.id);

      const top = await db
        .insert(courseComments)
        .values({
          courseId: course.id,
          authorId: user.id,
          parentCommentId: null,
          content: "Top",
        })
        .returning();
      const reply = await db
        .insert(courseComments)
        .values({
          courseId: course.id,
          authorId: user.id,
          parentCommentId: top[0].id,
          content: "Reply",
        })
        .returning();

      const response = await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/comments`)
        .set("Cookie", cookie)
        .send({ content: "Nested", parentCommentId: reply[0].id });

      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /comments/:id", () => {
    it("author edits own comment (200)", async () => {
      const author = await userFactory.create();
      const course = await createCourseFor(author.id);
      const { user, cookie } = await setupStudent();
      await enroll(user.id, course.id);

      const created = await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/comments`)
        .set("Cookie", cookie)
        .send({ content: "First version" });

      const response = await request(app.getHttpServer())
        .patch(`/api/comments/${created.body.data.id}`)
        .set("Cookie", cookie)
        .send({ content: "Edited" });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe("Edited");
    });

    it("rejects edit by another user (403)", async () => {
      const author = await userFactory.create();
      const course = await createCourseFor(author.id);
      const { user: studentA, cookie: cookieA } = await setupStudent();
      await enroll(studentA.id, course.id);
      const { user: studentB, cookie: cookieB } = await setupStudent();
      await enroll(studentB.id, course.id);

      const created = await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/comments`)
        .set("Cookie", cookieA)
        .send({ content: "Mine" });

      const response = await request(app.getHttpServer())
        .patch(`/api/comments/${created.body.data.id}`)
        .set("Cookie", cookieB)
        .send({ content: "Hacked" });

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /comments/:id", () => {
    it("admin deletes any comment with soft-delete (204)", async () => {
      const author = await userFactory.create();
      const course = await createCourseFor(author.id);
      const { user: student, cookie: studentCookie } = await setupStudent();
      await enroll(student.id, course.id);
      const { cookie: adminCookie } = await setupAdmin();

      const created = await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/comments`)
        .set("Cookie", studentCookie)
        .send({ content: "Will be deleted" });

      const response = await request(app.getHttpServer())
        .delete(`/api/comments/${created.body.data.id}`)
        .set("Cookie", adminCookie);

      expect(response.status).toBe(204);

      const [row] = await db
        .select()
        .from(courseComments)
        .where(eq(courseComments.id, created.body.data.id));
      expect(row.deletedAt).not.toBeNull();
    });
  });

  describe("GET /courses/:courseId/comments", () => {
    it("paginates with cursor and orders top-level newest-first", async () => {
      const author = await userFactory.create();
      const course = await createCourseFor(author.id);
      const { user, cookie } = await setupStudent();
      await enroll(user.id, course.id);

      // create 25 top-level comments to exercise pagination (default 20/page)
      for (let i = 0; i < 25; i += 1) {
        await db.insert(courseComments).values({
          courseId: course.id,
          authorId: user.id,
          parentCommentId: null,
          content: `Comment ${i}`,
        });
        // ensure ordering by createdAt
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const firstPage = await request(app.getHttpServer())
        .get(`/api/courses/${course.id}/comments`)
        .set("Cookie", cookie);

      expect(firstPage.status).toBe(200);
      expect(firstPage.body.data.data.length).toBe(20);
      expect(firstPage.body.data.nextCursor).toBeTruthy();

      const firstCreatedAt = firstPage.body.data.data[0].createdAt;
      const lastCreatedAtFirstPage =
        firstPage.body.data.data[firstPage.body.data.data.length - 1].createdAt;
      expect(new Date(firstCreatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(lastCreatedAtFirstPage).getTime(),
      );

      const secondPage = await request(app.getHttpServer())
        .get(`/api/courses/${course.id}/comments`)
        .query({ cursor: firstPage.body.data.nextCursor })
        .set("Cookie", cookie);

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.data.data.length).toBe(5);
      expect(secondPage.body.data.nextCursor).toBeNull();

      const firstPageIds = firstPage.body.data.data.map((c: { id: string }) => c.id);
      const secondPageIds = secondPage.body.data.data.map((c: { id: string }) => c.id);
      const overlap = secondPageIds.filter((id: string) => firstPageIds.includes(id));
      expect(overlap.length).toBe(0);
    });

    it("returns soft-deleted parent shell when replies exist", async () => {
      const author = await userFactory.create();
      const course = await createCourseFor(author.id);
      const { user, cookie } = await setupStudent();
      await enroll(user.id, course.id);

      const created = await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/comments`)
        .set("Cookie", cookie)
        .send({ content: "parent" });

      await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/comments`)
        .set("Cookie", cookie)
        .send({ content: "child", parentCommentId: created.body.data.id });

      // soft-delete parent
      await request(app.getHttpServer())
        .delete(`/api/comments/${created.body.data.id}`)
        .set("Cookie", cookie);

      const list = await request(app.getHttpServer())
        .get(`/api/courses/${course.id}/comments`)
        .set("Cookie", cookie);

      expect(list.status).toBe(200);
      const parent = list.body.data.data.find((c: { id: string }) => c.id === created.body.data.id);
      expect(parent).toBeDefined();
      expect(parent.isDeleted).toBe(true);
      expect(parent.replies.length).toBe(1);
    });
  });

  it("uniqueness: random course id used for token uniqueness", () => {
    expect(faker.string.uuid()).toBeTruthy();
  });
});
