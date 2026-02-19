import { and, eq } from "drizzle-orm";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";

import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { groupUsers, lessons, studentCourses } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("groupController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  const password = "password123";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    groupFactory = createGroupFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
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

  describe("GET /api/group/all", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).get("/api/group/all").expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);

        await request(app.getHttpServer()).get("/api/group/all").set("Cookie", cookies).expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);

        await request(app.getHttpServer()).get("/api/group/all").set("Cookie", cookies).expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("returns all groups", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group = await groupFactory.create();

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(group.id);
        expect(response.body.data[0].name).toBe(group.name);
        expect(response.body.data[0].characteristic).toBe(null);
        expect(response.body.pagination.totalItems).toBe(1);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.perPage).toBe(DEFAULT_PAGE_SIZE);
      });

      it("returns all groups with pagination", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        await groupFactory.create();
        const group2 = await groupFactory.create();

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .query({ perPage: 1, page: 2 })
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(group2.id);
      });

      it("returns all groups with sorting by name", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group1 = await groupFactory.create({ name: "B" });
        const group2 = await groupFactory.create({ name: "A" });

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .query({ sort: "name" })
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[1].id).toBe(group2.id);
        expect(response.body.data[0].id).toBe(group1.id);
      });

      it("returns all groups with sorting by created at", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group1 = await groupFactory.create({ name: "B" });
        const group2 = await groupFactory.create({ name: "A" });

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .query({ sort: "createdAt" })
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].id).toBe(group1.id);
        expect(response.body.data[1].id).toBe(group2.id);
      });

      it("returns all groups with filtering by keyword", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        await groupFactory.create({ name: "B" });
        const group1 = await groupFactory.create({ name: "AB" });
        const group2 = await groupFactory.create({ name: "A" });

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .query({ keyword: "A" })
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].id).toBe(group1.id);
        expect(response.body.data[1].id).toBe(group2.id);
      });
    });
  });

  describe("GET /api/group/:groupId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const group = await groupFactory.create();

        await request(app.getHttpServer()).get(`/api/group/${group.id}`).expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .get(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .get(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("returns group", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group = await groupFactory.create();

        const response = await request(app.getHttpServer())
          .get(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.id).toBe(group.id);
        expect(response.body.data.name).toBe(group.name);
        expect(response.body.data.characteristic).toBe(null);
      });
    });
  });

  describe("GET /api/group/user/:userId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const user = await userFactory.create();

        await request(app.getHttpServer()).get(`/api/group/user/${user.id}`).expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const user = await userFactory.create();

        await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const user = await userFactory.create();

        await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("returns user groups", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const user = await userFactory.create();
        const group = await groupFactory.create();
        await db.insert(groupUsers).values({ userId: user.id, groupId: group.id });

        const response = await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(group.id);
        expect(response.body.data[0].name).toBe(group.name);
        expect(response.body.data[0].characteristic).toBe(null);
        expect(response.body.pagination.totalItems).toBe(1);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.perPage).toBe(DEFAULT_PAGE_SIZE);
      });

      it("returns user groups with pagination", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const user = await userFactory.create();
        const group = await groupFactory.create();
        await db.insert(groupUsers).values({ userId: user.id, groupId: group.id });

        const response = await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .query({ perPage: 1, page: 2 })
          .expect(200);

        expect(response.body.data).toHaveLength(0);
      });

      it("returns user groups with filtering by keyword", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const user = await userFactory.create();
        const group = await groupFactory.create({ name: "A" });
        await groupFactory.create({ name: "B" });
        await db.insert(groupUsers).values({ userId: user.id, groupId: group.id });

        const response = await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .query({ keyword: "B" })
          .expect(200);

        expect(response.body.data).toHaveLength(0);
      });
    });
  });

  describe("POST /api/group", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .post("/api/group")
          .send({ name, characteristic })
          .expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .post("/api/group")
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .post("/api/group")
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("creates a group", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .post("/api/group")
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(201);
      });
    });
  });

  describe("PATCH /api/group/:groupId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const group = await groupFactory.create();
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .patch(`/api/group/${group.id}`)
          .send({ name, characteristic })
          .expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .patch(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .patch(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("updates a group", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group = await groupFactory.create();
        const name = "Programmers";
        const characteristic = "People who love programming";

        const response = await request(app.getHttpServer())
          .patch(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(200);

        expect(response.body.data.id).toBe(group.id);
        expect(response.body.data.name).toBe(name);
        expect(response.body.data.characteristic).toBe(characteristic);
      });

      it("returns 404 if group does not exist", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .patch(`/api/group/${uuidv4()}`)
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(404);
      });
    });
  });

  describe("DELETE /api/group/:groupId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const group = await groupFactory.create();

        await request(app.getHttpServer()).delete(`/api/group/${group.id}`).expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .delete(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .delete(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("deletes a group", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .delete(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(200);
      });

      it("returns 404 if group does not exist", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);

        await request(app.getHttpServer())
          .delete(`/api/group/${uuidv4()}`)
          .set("Cookie", cookies)
          .expect(404);
      });
    });
  });

  describe("DELETE /api/group", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).delete("/api/group").expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);

        await request(app.getHttpServer()).delete("/api/group").set("Cookie", cookies).expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);

        await request(app.getHttpServer()).delete("/api/group").set("Cookie", cookies).expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("deletes groups", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group1 = await groupFactory.create();
        const group2 = await groupFactory.create();

        await request(app.getHttpServer())
          .delete("/api/group")
          .set("Cookie", cookies)
          .send([group1.id, group2.id])
          .expect(200);
      });

      it("returns 400 if groups array is empty", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);

        await request(app.getHttpServer())
          .delete("/api/group")
          .set("Cookie", cookies)
          .send({ groupIds: [] })
          .expect(400);
      });
    });
  });

  describe("POST /api/group/set - Auto enroll user to group courses", () => {
    it("should automatically enroll user to all courses the group is enrolled in", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();

      const category = await categoryFactory.create();
      const course1 = await courseFactory.create({
        authorId: admin.id,
        categoryId: category.id,
        status: "published",
      });
      const course2 = await courseFactory.create({
        authorId: admin.id,
        categoryId: category.id,
        status: "published",
      });

      const chapter1 = await chapterFactory.create({
        courseId: course1.id,
        title: "Chapter 1",
        isFreemium: true,
      });
      await db.insert(lessons).values({
        chapterId: chapter1.id,
        type: LESSON_TYPES.QUIZ,
        title: "Quiz",
        thresholdScore: 0,
      });

      const chapter2 = await chapterFactory.create({
        courseId: course2.id,
        title: "Chapter 2",
        isFreemium: true,
      });
      await db.insert(lessons).values({
        chapterId: chapter2.id,
        type: LESSON_TYPES.QUIZ,
        title: "Quiz",
        thresholdScore: 0,
      });

      const existingUser1 = await userFactory.withCredentials({ password }).create();
      const group = await groupFactory.withMembers([existingUser1.id]).create();

      const cookies = await cookieFor(admin, app);
      await request(app.getHttpServer())
        .post(`/api/course/${course1.id}/enroll-groups-to-course`)
        .send({ groups: [{ id: group.id, isMandatory: false }] })
        .set("Cookie", cookies)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/course/${course2.id}/enroll-groups-to-course`)
        .send({ groups: [{ id: group.id, isMandatory: false }] })
        .set("Cookie", cookies)
        .expect(201);

      const newUser = await userFactory.withCredentials({ password }).create();

      await request(app.getHttpServer())
        .post(`/api/group/set?userId=${newUser.id}`)
        .send([group.id])
        .set("Cookie", cookies)
        .expect(201);

      const enrollments = await db
        .select()
        .from(studentCourses)
        .where(eq(studentCourses.studentId, newUser.id));

      expect(enrollments.length).toBe(2);

      const course1Enrollment = enrollments.find((e) => e.courseId === course1.id);
      expect(course1Enrollment?.enrolledByGroupId).toBe(group.id);

      const course2Enrollment = enrollments.find((e) => e.courseId === course2.id);
      expect(course2Enrollment?.enrolledByGroupId).toBe(group.id);

      const course3 = await courseFactory.create({
        authorId: admin.id,
        categoryId: category.id,
        status: "published",
      });

      const course3Enrollments = await db
        .select()
        .from(studentCourses)
        .where(
          and(eq(studentCourses.studentId, newUser.id), eq(studentCourses.courseId, course3.id)),
        );

      expect(course3Enrollments.length).toBe(0);
    });

    it("should not enroll user to courses they are already enrolled in", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();

      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        authorId: admin.id,
        categoryId: category.id,
        status: "published",
      });

      const chapter = await chapterFactory.create({
        courseId: course.id,
        title: "Chapter",
        isFreemium: true,
      });

      await db.insert(lessons).values({
        chapterId: chapter.id,
        type: LESSON_TYPES.QUIZ,
        title: "Quiz",
        thresholdScore: 0,
      });

      const user = await userFactory.withCredentials({ password }).create();
      const existingGroupMember = await userFactory.withCredentials({ password }).create();
      const group = await groupFactory.withMembers([existingGroupMember.id]).create();

      const cookies = await cookieFor(admin, app);
      await request(app.getHttpServer())
        .post(`/api/course/${course.id}/enroll-groups-to-course`)
        .send({ groups: [{ id: group.id, isMandatory: false }] })
        .set("Cookie", cookies)
        .expect(201);

      await db.insert(studentCourses).values({
        studentId: user.id,
        courseId: course.id,
        enrolledByGroupId: null,
      });

      await request(app.getHttpServer())
        .post(`/api/group/set?userId=${user.id}`)
        .send([group.id])
        .set("Cookie", cookies)
        .expect(201);

      const enrollment = await db
        .select()
        .from(studentCourses)
        .where(and(eq(studentCourses.studentId, user.id), eq(studentCourses.courseId, course.id)));

      expect(enrollment.length).toBe(1);
      expect(enrollment[0]?.enrolledByGroupId).toBe(null);
    });
  });
});
