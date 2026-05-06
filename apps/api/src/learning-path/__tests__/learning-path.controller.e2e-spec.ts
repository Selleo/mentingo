import { faker } from "@faker-js/faker";
import { LEARNING_PATH_ENROLLMENT_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";

import { LearningPathCourseSyncEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  groupLearningPaths,
  learningPathCourses,
  learningPaths,
  studentLearningPathCourses,
  studentLearningPaths,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLearningPathFactory } from "../../../test/factory/learningPath.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";
import { LEARNING_PATH_ERRORS } from "../constants/learning-path.errors";
import { LEARNING_PATH_SUCCESS_MESSAGES } from "../constants/learning-path.success-messages";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

const TABLES_TO_TRUNCATE: Parameters<typeof truncateTables>[1] = [
  "student_learning_path_courses",
  "student_learning_paths",
  "student_courses",
  "group_learning_paths",
  "learning_path_courses",
  "learning_paths",
  "courses",
  "categories",
  "group_users",
  "groups",
  "users",
  "settings",
];

describe("LearningPathController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let learningPathFactory: ReturnType<typeof createLearningPathFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  const testPassword = "Password123@@";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    groupFactory = createGroupFactory(db);
    learningPathFactory = createLearningPathFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Learning Path Management", () => {
    let adminUser: UserWithCredentials;
    let adminCookies: string;

    beforeEach(async () => {
      await truncateTables(baseDb, TABLES_TO_TRUNCATE);
      await settingsFactory.create({ userId: null });

      adminUser = await userFactory
        .withCredentials({ password: testPassword })
        .withAdminSettings(db)
        .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

      adminCookies = await cookieFor(adminUser, app);
    });

    describe("POST /api/learning-path", () => {
      it("should create a learning path using the provided language as base language", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/learning-path")
          .set("Cookie", adminCookies)
          .send({
            language: "pl",
            title: "Path title",
            description: "Path description",
            includesCertificate: true,
            sequenceEnabled: true,
          })
          .expect(201);

        expect(response.body.data.baseLanguage).toBe("pl");
        expect(response.body.data.availableLocales).toEqual(["pl"]);
        expect(response.body.data.title.pl).toBe("Path title");
        expect(response.body.data.description.pl).toBe("Path description");
        expect(response.body.data.includesCertificate).toBe(true);
        expect(response.body.data.sequenceEnabled).toBe(true);
      });

      it("should return 401 when unauthenticated", async () => {
        await request(app.getHttpServer())
          .post("/api/learning-path")
          .send({
            language: "pl",
            title: "Path title",
            description: "Path description",
          })
          .expect(401);
      });

      it("should return 403 when user cannot manage learning paths", async () => {
        const student = await userFactory
          .withCredentials({ password: testPassword })
          .withUserSettings(db)
          .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const studentCookies = await cookieFor(student, app);

        await request(app.getHttpServer())
          .post("/api/learning-path")
          .set("Cookie", studentCookies)
          .send({
            language: "pl",
            title: "Path title",
            description: "Path description",
          })
          .expect(403);
      });
    });

    describe("GET /api/learning-path", () => {
      it("should return paginated learning paths", async () => {
        await learningPathFactory.create({ authorId: adminUser.id });

        const response = await request(app.getHttpServer())
          .get("/api/learning-path?page=1&perPage=10")
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.pagination).toEqual({
          totalItems: 1,
          page: 1,
          perPage: 10,
        });
      });
    });

    describe("GET /api/learning-path/:learningPathId", () => {
      it("should return a learning path with ordered courses", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        const response = await request(app.getHttpServer())
          .get(`/api/learning-path/${learningPath.id}`)
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.id).toBe(learningPath.id);
        expect(response.body.data.courses).toEqual([
          expect.objectContaining({ courseId: courseOne.id, displayOrder: 1 }),
          expect.objectContaining({ courseId: courseTwo.id, displayOrder: 2 }),
        ]);
      });

      it("should return not found for missing learning path", async () => {
        await request(app.getHttpServer())
          .get(`/api/learning-path/${faker.string.uuid()}`)
          .set("Cookie", adminCookies)
          .expect(404);
      });
    });

    describe("PATCH /api/learning-path/:learningPathId", () => {
      it("should update learning path settings and localized fields", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });

        const response = await request(app.getHttpServer())
          .patch(`/api/learning-path/${learningPath.id}`)
          .set("Cookie", adminCookies)
          .send({
            language: "pl",
            title: "Updated title",
            includesCertificate: false,
            sequenceEnabled: false,
          })
          .expect(200);

        expect(response.body.data.includesCertificate).toBe(false);
        expect(response.body.data.sequenceEnabled).toBe(false);
        expect(response.body.data.title.pl).toBe("Updated title");
      });

      it("should publish course sync when sequence setting changes", async () => {
        const learningPath = await learningPathFactory.create({
          authorId: adminUser.id,
          sequenceEnabled: false,
        });
        const publishSpy = jest.spyOn(app.get(OutboxPublisher), "publish");

        publishSpy.mockClear();

        await request(app.getHttpServer())
          .patch(`/api/learning-path/${learningPath.id}`)
          .set("Cookie", adminCookies)
          .send({ sequenceEnabled: true })
          .expect(200);

        expect(publishSpy).toHaveBeenCalledWith(
          expect.any(LearningPathCourseSyncEvent),
          expect.anything(),
        );
      });

      it("should require language when updating localized fields", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });

        const response = await request(app.getHttpServer())
          .patch(`/api/learning-path/${learningPath.id}`)
          .set("Cookie", adminCookies)
          .send({ title: "Updated title" })
          .expect(400);

        expect(response.body.message).toBe(LEARNING_PATH_ERRORS.UPDATE_MISSING_LANGUAGE);
      });

      it("should reject localized updates for unavailable language", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });

        const response = await request(app.getHttpServer())
          .patch(`/api/learning-path/${learningPath.id}`)
          .set("Cookie", adminCookies)
          .send({ language: "en", title: "Updated title" })
          .expect(400);

        expect(response.body.message).toBe(LEARNING_PATH_ERRORS.LANGUAGE_NOT_SUPPORTED);
      });
    });

    describe("POST /api/learning-path/:learningPathId/courses", () => {
      it("should add courses to a learning path in display order", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);

        const response = await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        expect(response.body.data.message).toBe(LEARNING_PATH_SUCCESS_MESSAGES.COURSES_ADDED);

        const rows = await baseDb
          .select({
            courseId: learningPathCourses.courseId,
            displayOrder: learningPathCourses.displayOrder,
          })
          .from(learningPathCourses)
          .where(eq(learningPathCourses.learningPathId, learningPath.id))
          .orderBy(learningPathCourses.displayOrder);

        expect(rows).toEqual([
          { courseId: courseOne.id, displayOrder: 1 },
          { courseId: courseTwo.id, displayOrder: 2 },
        ]);
      });

      it("should return bad request for duplicate course ids", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne } = await createCourses(adminUser.id);

        const response = await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseOne.id] })
          .expect(400);

        expect(response.body.message).toBe(LEARNING_PATH_ERRORS.COURSE_IDS_UNIQUE);
      });

      it("should return not found for missing course ids", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });

        const response = await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [faker.string.uuid()] })
          .expect(404);

        expect(response.body.message).toBe(LEARNING_PATH_ERRORS.COURSE_NOT_FOUND);
      });

      it("should return conflict when adding a course already assigned to the learning path", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne } = await createCourses(adminUser.id);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id] })
          .expect(201);

        const response = await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id] })
          .expect(409);

        expect(response.body.message).toBe(LEARNING_PATH_ERRORS.COURSE_ALREADY_EXISTS);
      });
    });

    describe("DELETE /api/learning-path/:learningPathId/courses/:courseId", () => {
      it("should remove a course and compact remaining display order", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        const response = await request(app.getHttpServer())
          .delete(`/api/learning-path/${learningPath.id}/courses/${courseOne.id}`)
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.message).toBe(LEARNING_PATH_SUCCESS_MESSAGES.COURSE_REMOVED);

        const rows = await baseDb
          .select({
            courseId: learningPathCourses.courseId,
            displayOrder: learningPathCourses.displayOrder,
          })
          .from(learningPathCourses)
          .where(eq(learningPathCourses.learningPathId, learningPath.id))
          .orderBy(learningPathCourses.displayOrder);

        expect(rows).toEqual([{ courseId: courseTwo.id, displayOrder: 1 }]);
      });
    });

    describe("PATCH /api/learning-path/:learningPathId/courses/reorder", () => {
      it("should reorder learning path courses", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        const response = await request(app.getHttpServer())
          .patch(`/api/learning-path/${learningPath.id}/courses/reorder`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseTwo.id, courseOne.id] })
          .expect(200);

        expect(response.body.data.message).toBe(LEARNING_PATH_SUCCESS_MESSAGES.COURSES_REORDERED);

        const rows = await baseDb
          .select({
            courseId: learningPathCourses.courseId,
            displayOrder: learningPathCourses.displayOrder,
          })
          .from(learningPathCourses)
          .where(eq(learningPathCourses.learningPathId, learningPath.id))
          .orderBy(learningPathCourses.displayOrder);

        expect(rows).toEqual([
          { courseId: courseTwo.id, displayOrder: 1 },
          { courseId: courseOne.id, displayOrder: 2 },
        ]);
      });

      it("should publish course sync when sequenced courses are reordered", async () => {
        const learningPath = await learningPathFactory.create({
          authorId: adminUser.id,
          sequenceEnabled: true,
        });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);
        const publishSpy = jest.spyOn(app.get(OutboxPublisher), "publish");

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        publishSpy.mockClear();

        await request(app.getHttpServer())
          .patch(`/api/learning-path/${learningPath.id}/courses/reorder`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseTwo.id, courseOne.id] })
          .expect(200);

        expect(publishSpy).toHaveBeenCalledWith(
          expect.any(LearningPathCourseSyncEvent),
          expect.anything(),
        );
      });

      it("should reject reorder payload that does not match current courses", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        const response = await request(app.getHttpServer())
          .patch(`/api/learning-path/${learningPath.id}/courses/reorder`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id] })
          .expect(400);

        expect(response.body.message).toBe(LEARNING_PATH_ERRORS.COURSE_IDS_MISMATCH);
      });
    });

    describe("POST /api/learning-path/:learningPathId/enroll-users", () => {
      it("should enroll bulk users to a learning path", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);
        const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        const response = await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-users`)
          .set("Cookie", adminCookies)
          .send({ studentIds: [student.id, student.id, faker.string.uuid()] })
          .expect(201);

        expect(response.body.data.message).toBe(LEARNING_PATH_SUCCESS_MESSAGES.USERS_ENROLLED);

        const [studentPathEnrollment] = await baseDb
          .select({
            studentId: studentLearningPaths.studentId,
            enrollmentType: studentLearningPaths.enrollmentType,
          })
          .from(studentLearningPaths)
          .where(eq(studentLearningPaths.learningPathId, learningPath.id));

        expect(studentPathEnrollment).toEqual({
          studentId: student.id,
          enrollmentType: LEARNING_PATH_ENROLLMENT_TYPES.DIRECT,
        });

        const studentPathCourseRows = await baseDb
          .select()
          .from(studentLearningPathCourses)
          .where(eq(studentLearningPathCourses.learningPathId, learningPath.id));

        expect(studentPathCourseRows).toHaveLength(2);
      });

      it("should skip users that are already group enrolled", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);
        const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const group = await groupFactory.withMembers([student.id]).create();

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-groups`)
          .set("Cookie", adminCookies)
          .send({ groupIds: [group.id] })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-users`)
          .set("Cookie", adminCookies)
          .send({ studentIds: [student.id] })
          .expect(201);

        const [studentPathEnrollment] = await baseDb
          .select({
            studentId: studentLearningPaths.studentId,
            enrollmentType: studentLearningPaths.enrollmentType,
          })
          .from(studentLearningPaths)
          .where(eq(studentLearningPaths.learningPathId, learningPath.id));

        expect(studentPathEnrollment).toEqual({
          studentId: student.id,
          enrollmentType: LEARNING_PATH_ENROLLMENT_TYPES.GROUP,
        });
      });
    });

    describe("DELETE /api/learning-path/:learningPathId/enroll-users", () => {
      it("should keep user enrolled by group when direct enrollment is removed", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);
        const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const group = await groupFactory.withMembers([student.id]).create();

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-users`)
          .set("Cookie", adminCookies)
          .send({ studentIds: [student.id] })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-groups`)
          .set("Cookie", adminCookies)
          .send({ groupIds: [group.id, group.id, faker.string.uuid()] })
          .expect(201);

        const response = await request(app.getHttpServer())
          .delete(`/api/learning-path/${learningPath.id}/enroll-users`)
          .set("Cookie", adminCookies)
          .send({ studentIds: [student.id] })
          .expect(200);

        expect(response.body.data.message).toBe(LEARNING_PATH_SUCCESS_MESSAGES.USERS_UNENROLLED);

        const [studentPathEnrollment] = await baseDb
          .select({
            studentId: studentLearningPaths.studentId,
            enrollmentType: studentLearningPaths.enrollmentType,
          })
          .from(studentLearningPaths)
          .where(eq(studentLearningPaths.learningPathId, learningPath.id));

        expect(studentPathEnrollment).toEqual({
          studentId: student.id,
          enrollmentType: LEARNING_PATH_ENROLLMENT_TYPES.GROUP,
        });

        const studentPathCourseRows = await baseDb
          .select()
          .from(studentLearningPathCourses)
          .where(eq(studentLearningPathCourses.learningPathId, learningPath.id));

        expect(studentPathCourseRows).toHaveLength(2);
      });

      it("should unenroll a directly enrolled user without group fallback", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);
        const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-users`)
          .set("Cookie", adminCookies)
          .send({ studentIds: [student.id] })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/api/learning-path/${learningPath.id}/enroll-users`)
          .set("Cookie", adminCookies)
          .send({ studentIds: [student.id] })
          .expect(200);

        const studentPathEnrollment = await baseDb.query.studentLearningPaths.findFirst({
          where: eq(studentLearningPaths.learningPathId, learningPath.id),
        });
        const studentPathCourseRows = await baseDb
          .select()
          .from(studentLearningPathCourses)
          .where(eq(studentLearningPathCourses.learningPathId, learningPath.id));

        expect(studentPathEnrollment).toBeUndefined();
        expect(studentPathCourseRows).toHaveLength(0);
      });
    });

    describe("POST /api/learning-path/:learningPathId/enroll-groups", () => {
      it("should enroll groups and their current members to a learning path", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);
        const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const group = await groupFactory.withMembers([student.id]).create();

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        const response = await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-groups`)
          .set("Cookie", adminCookies)
          .send({ groupIds: [group.id] })
          .expect(201);

        expect(response.body.data.message).toBe(LEARNING_PATH_SUCCESS_MESSAGES.GROUPS_ENROLLED);

        const [groupPathEnrollment] = await baseDb
          .select()
          .from(groupLearningPaths)
          .where(eq(groupLearningPaths.learningPathId, learningPath.id));

        expect(groupPathEnrollment?.groupId).toBe(group.id);

        const [studentPathEnrollment] = await baseDb
          .select({
            studentId: studentLearningPaths.studentId,
            enrollmentType: studentLearningPaths.enrollmentType,
          })
          .from(studentLearningPaths)
          .where(eq(studentLearningPaths.learningPathId, learningPath.id));

        expect(studentPathEnrollment).toEqual({
          studentId: student.id,
          enrollmentType: LEARNING_PATH_ENROLLMENT_TYPES.GROUP,
        });
      });
    });

    describe("DELETE /api/learning-path/:learningPathId/enroll-groups", () => {
      it("should keep directly enrolled users enrolled when their group is unenrolled", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);
        const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const group = await groupFactory.withMembers([student.id]).create();

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-users`)
          .set("Cookie", adminCookies)
          .send({ studentIds: [student.id] })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-groups`)
          .set("Cookie", adminCookies)
          .send({ groupIds: [group.id] })
          .expect(201);

        const response = await request(app.getHttpServer())
          .delete(`/api/learning-path/${learningPath.id}/enroll-groups`)
          .set("Cookie", adminCookies)
          .send({ groupIds: [group.id] })
          .expect(200);

        expect(response.body.data.message).toBe(LEARNING_PATH_SUCCESS_MESSAGES.GROUPS_UNENROLLED);

        const [studentPathEnrollment] = await baseDb
          .select({
            studentId: studentLearningPaths.studentId,
            enrollmentType: studentLearningPaths.enrollmentType,
          })
          .from(studentLearningPaths)
          .where(eq(studentLearningPaths.learningPathId, learningPath.id));
        const groupPathEnrollment = await baseDb.query.groupLearningPaths.findFirst({
          where: eq(groupLearningPaths.learningPathId, learningPath.id),
        });

        expect(studentPathEnrollment).toEqual({
          studentId: student.id,
          enrollmentType: LEARNING_PATH_ENROLLMENT_TYPES.DIRECT,
        });
        expect(groupPathEnrollment).toBeUndefined();
      });

      it("should unenroll group-only users when their group is unenrolled", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);
        const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const group = await groupFactory.withMembers([student.id]).create();

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-groups`)
          .set("Cookie", adminCookies)
          .send({ groupIds: [group.id] })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/api/learning-path/${learningPath.id}/enroll-groups`)
          .set("Cookie", adminCookies)
          .send({ groupIds: [group.id] })
          .expect(200);

        const studentPathEnrollment = await baseDb.query.studentLearningPaths.findFirst({
          where: eq(studentLearningPaths.learningPathId, learningPath.id),
        });
        const studentPathCourseRows = await baseDb
          .select()
          .from(studentLearningPathCourses)
          .where(eq(studentLearningPathCourses.learningPathId, learningPath.id));

        expect(studentPathEnrollment).toBeUndefined();
        expect(studentPathCourseRows).toHaveLength(0);
      });

      it("should keep group-enrolled users enrolled through another enrolled group", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
        const { courseOne, courseTwo } = await createCourses(adminUser.id);
        const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
        const firstGroup = await groupFactory.withMembers([student.id]).create();
        const secondGroup = await groupFactory.withMembers([student.id]).create();

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/courses`)
          .set("Cookie", adminCookies)
          .send({ courseIds: [courseOne.id, courseTwo.id] })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/learning-path/${learningPath.id}/enroll-groups`)
          .set("Cookie", adminCookies)
          .send({ groupIds: [firstGroup.id, secondGroup.id] })
          .expect(201);

        await request(app.getHttpServer())
          .delete(`/api/learning-path/${learningPath.id}/enroll-groups`)
          .set("Cookie", adminCookies)
          .send({ groupIds: [firstGroup.id] })
          .expect(200);

        const [studentPathEnrollment] = await baseDb
          .select({
            studentId: studentLearningPaths.studentId,
            enrollmentType: studentLearningPaths.enrollmentType,
          })
          .from(studentLearningPaths)
          .where(eq(studentLearningPaths.learningPathId, learningPath.id));
        const studentPathCourseRows = await baseDb
          .select()
          .from(studentLearningPathCourses)
          .where(eq(studentLearningPathCourses.learningPathId, learningPath.id));

        expect(studentPathEnrollment).toEqual({
          studentId: student.id,
          enrollmentType: LEARNING_PATH_ENROLLMENT_TYPES.GROUP,
        });
        expect(studentPathCourseRows).toHaveLength(2);
      });
    });

    describe("DELETE /api/learning-path/:learningPathId", () => {
      it("should delete a learning path", async () => {
        const learningPath = await learningPathFactory.create({ authorId: adminUser.id });

        const response = await request(app.getHttpServer())
          .delete(`/api/learning-path/${learningPath.id}`)
          .set("Cookie", adminCookies)
          .expect(200);

        expect(response.body.data.message).toBe(LEARNING_PATH_SUCCESS_MESSAGES.DELETED);

        const deletedLearningPath = await baseDb.query.learningPaths.findFirst({
          where: eq(learningPaths.id, learningPath.id),
        });

        expect(deletedLearningPath).toBeUndefined();
      });
    });
  });

  async function createCourses(authorId: string) {
    const courseOne = await courseFactory.create({
      authorId,
      status: "published",
      thumbnailS3Key: null,
    });
    const courseTwo = await courseFactory.create({
      authorId,
      status: "published",
      thumbnailS3Key: null,
    });

    return { courseOne, courseTwo };
  }
});
