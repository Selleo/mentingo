import { faker } from "@faker-js/faker";
import { COURSE_ENROLLMENT, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { studentCourses, users } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  COURSE_ENROLLMENT_TABLES,
  createCourseEnrollmentHelpers,
} from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  BULK_ENROLLMENT_REJECTIONS,
  BULK_ENROLLMENT_REJECTION_CASES,
  ENROLLMENT_COURSE_CONTENT,
  SELF_ENROLLMENT_REJECTIONS,
  SELF_ENROLLMENT_REJECTION_CASES,
  UNENROLLMENT_REJECTIONS,
  UNENROLLMENT_REJECTION_CASES,
} from "./course-enrollment.scenarios";

import type {
  BulkEnrollmentRejection,
  SelfEnrollmentRejection,
  UnenrollmentRejection,
} from "./course-enrollment.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const cacheManagerMock = {
  get: jest.fn(),
  set: jest.fn(),
};

describe("Course enrollment (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCourseEnrollmentHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: "CACHE_MANAGER", useValue: cacheManagerMock }],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createCourseEnrollmentHelpers({ app, db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_ENROLLMENT_TABLES);

    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());
    cacheManagerMock.get.mockResolvedValue("");
    cacheManagerMock.set.mockResolvedValue("");

    await helpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_ENROLLMENT_TABLES);
  });

  const enrollSelf = (learner: SignedInUser, courseId: UUIDType, expectedStatus = 201) =>
    request(app.getHttpServer())
      .post("/api/course/enroll-course")
      .query({ id: courseId })
      .set("Cookie", learner.cookies)
      .expect(expectedStatus);

  const enrollStudents = (
    admin: SignedInUser,
    courseId: UUIDType,
    studentIds: UUIDType[],
    expectedStatus = 201,
  ) =>
    request(app.getHttpServer())
      .post(`/api/course/${courseId}/enroll-courses`)
      .set("Cookie", admin.cookies)
      .send({ studentIds })
      .expect(expectedStatus);

  const enrollGroup = (admin: SignedInUser, courseId: UUIDType, groupId: UUIDType) =>
    request(app.getHttpServer())
      .post(`/api/course/${courseId}/enroll-groups-to-course`)
      .set("Cookie", admin.cookies)
      .send({ groups: [{ id: groupId, isMandatory: false, dueDate: null }] })
      .expect(201);

  const unenrollStudents = (
    admin: SignedInUser,
    courseId: UUIDType,
    studentIds: UUIDType[],
    expectedStatus = 200,
  ) =>
    request(app.getHttpServer())
      .delete(
        `/api/course/unenroll-course?courseId=${courseId}&${studentIds
          .map((studentId) => `userIds[]=${studentId}`)
          .join("&")}`,
      )
      .set("Cookie", admin.cookies)
      .expect(expectedStatus);

  const clearGroupAttribution = (studentId: UUIDType, courseId: UUIDType) =>
    runInTenant(() =>
      db
        .update(studentCourses)
        .set({ enrolledByGroupId: null })
        .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId))),
    );

  const arrangeCourse = (authorId: UUIDType) =>
    helpers.arrangeCourseWithContent({ authorId, contentShape: ENROLLMENT_COURSE_CONTENT });

  describe("POST /api/course/enroll-course", () => {
    it("enrolls the learner and prepares course progress", async () => {
      const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const student = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { course, chapters } = await arrangeCourse(author.id);
      const [chapterWithLessons, chapterWithoutLessons] = chapters;
      const [quizLesson, contentLesson] = chapterWithLessons.lessons;

      const response = await enrollSelf(student, course.id);

      expect(response.body.data).toEqual({ message: "Course enrolled successfully" });
      expect(await helpers.findStudentEnrollment(student.user.id, course.id)).toEqual({
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: expect.any(String),
        enrolledByGroupId: null,
        paymentId: null,
      });
      expect(await helpers.findStudentCourseProgress(student.user.id, course.id)).toEqual({
        chapterProgress: expect.arrayContaining([
          {
            chapterId: chapterWithLessons.chapter.id,
            completedLessonCount: 0,
            learningStateId: null,
          },
          {
            chapterId: chapterWithoutLessons.chapter.id,
            completedLessonCount: 0,
            learningStateId: null,
          },
        ]),
        lessonProgress: expect.arrayContaining([
          {
            lessonId: quizLesson.id,
            chapterId: chapterWithLessons.chapter.id,
            quizScore: 0,
            completedAt: null,
            learningStateId: null,
          },
          {
            lessonId: contentLesson.id,
            chapterId: chapterWithLessons.chapter.id,
            quizScore: null,
            completedAt: null,
            learningStateId: null,
          },
        ]),
      });
    });

    it("re-enrolls a learner who was previously unenrolled", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const student = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { course } = await arrangeCourse(admin.user.id);

      await enrollSelf(student, course.id);
      await unenrollStudents(admin, course.id, [student.user.id]);
      await enrollSelf(student, course.id);

      expect(await helpers.findStudentEnrollment(student.user.id, course.id)).toEqual({
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: expect.any(String),
        enrolledByGroupId: null,
        paymentId: null,
      });
    });

    const arrangeSelfEnrollmentRejection = async (
      rejection: SelfEnrollmentRejection,
    ): Promise<{ learner: SignedInUser; courseId: UUIDType }> =>
      match(rejection)
        .with(SELF_ENROLLMENT_REJECTIONS.MISSING_COURSE, async () => ({
          learner: await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT),
          courseId: faker.string.uuid(),
        }))
        .with(SELF_ENROLLMENT_REJECTIONS.OWN_COURSE, async () => {
          const contentCreator = await helpers.arrangeSignedInUser(
            SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
          );
          const { course } = await arrangeCourse(contentCreator.user.id);

          return { learner: contentCreator, courseId: course.id };
        })
        .with(SELF_ENROLLMENT_REJECTIONS.ARCHIVED_COURSE, async () => {
          const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
          const { course } = await helpers.arrangeCourseWithContent({
            authorId: author.id,
            contentShape: ENROLLMENT_COURSE_CONTENT,
            course: { isArchived: true },
          });

          return {
            learner: await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT),
            courseId: course.id,
          };
        })
        .with(SELF_ENROLLMENT_REJECTIONS.ALREADY_ENROLLED, async () => {
          const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
          const { course } = await arrangeCourse(author.id);
          const learner = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);

          await enrollSelf(learner, course.id);

          return { learner, courseId: course.id };
        })
        .exhaustive();

    it.each(SELF_ENROLLMENT_REJECTION_CASES)(
      "rejects with $expectedStatus when $rejection",
      async ({ rejection, expectedStatus, expectedMessage }) => {
        const { learner, courseId } = await arrangeSelfEnrollmentRejection(rejection);

        const response = await enrollSelf(learner, courseId, expectedStatus);

        expect(response.body).toMatchObject({ message: expectedMessage });
      },
    );
  });

  describe("POST /api/course/:courseId/enroll-courses", () => {
    const arrangeBulkEnrollmentStudentIds = async (
      rejection: BulkEnrollmentRejection,
    ): Promise<UUIDType[]> =>
      match(rejection)
        .with(BULK_ENROLLMENT_REJECTIONS.NO_STUDENTS, async () => [])
        .with(BULK_ENROLLMENT_REJECTIONS.UNKNOWN_STUDENT, async () => {
          const student = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);

          return [student.id, faker.string.uuid()];
        })
        .with(BULK_ENROLLMENT_REJECTIONS.DELETED_STUDENT, async () => {
          const student = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
          await runInTenant(() =>
            db
              .update(users)
              .set({ deletedAt: new Date().toISOString() })
              .where(eq(users.id, student.id)),
          );

          return [student.id];
        })
        .exhaustive();

    it.each(BULK_ENROLLMENT_REJECTION_CASES)(
      "rejects the enrollment when $rejection",
      async ({ rejection, expectedMessage }) => {
        const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const { course } = await arrangeCourse(admin.user.id);
        const studentIds = await arrangeBulkEnrollmentStudentIds(rejection);

        const response = await enrollStudents(admin, course.id, studentIds, 400);

        expect(response.body).toMatchObject({ message: expectedMessage });
        for (const studentId of studentIds) {
          expect(await helpers.findStudentEnrollment(studentId, course.id)).toBeUndefined();
        }
      },
    );

    it("re-enrolls students who were previously unenrolled", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const student = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { course } = await arrangeCourse(admin.user.id);

      await enrollStudents(admin, course.id, [student.id]);
      await unenrollStudents(admin, course.id, [student.id]);
      await enrollStudents(admin, course.id, [student.id]);

      expect(await helpers.findStudentEnrollment(student.id, course.id)).toEqual({
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: expect.any(String),
        enrolledByGroupId: null,
        paymentId: null,
      });
    });
  });

  describe("DELETE /api/course/unenroll-course", () => {
    it("unenrolls a directly enrolled student", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const student = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { course } = await arrangeCourse(admin.user.id);

      await enrollStudents(admin, course.id, [student.id]);
      await unenrollStudents(admin, course.id, [student.id]);

      expect(await helpers.findStudentEnrollment(student.id, course.id)).toEqual({
        status: COURSE_ENROLLMENT.NOT_ENROLLED,
        enrolledAt: null,
        enrolledByGroupId: null,
        paymentId: null,
      });
    });

    it("keeps a student enrolled through a group they belong to", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const student = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { course } = await arrangeCourse(admin.user.id);
      const group = await helpers.arrangeGroupWithMembers([student.id]);

      await enrollStudents(admin, course.id, [student.id]);
      await enrollGroup(admin, course.id, group.id);
      await clearGroupAttribution(student.id, course.id);

      await unenrollStudents(admin, course.id, [student.id]);

      expect(await helpers.findStudentEnrollment(student.id, course.id)).toMatchObject({
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledByGroupId: group.id,
      });
    });

    it("unenrolls direct students and keeps group members enrolled in one request", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const directStudent = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const groupStudent = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { course } = await arrangeCourse(admin.user.id);
      const group = await helpers.arrangeGroupWithMembers([groupStudent.id]);

      await enrollStudents(admin, course.id, [directStudent.id, groupStudent.id]);
      await enrollGroup(admin, course.id, group.id);
      await clearGroupAttribution(groupStudent.id, course.id);

      await unenrollStudents(admin, course.id, [directStudent.id, groupStudent.id]);

      expect({
        direct: await helpers.findStudentEnrollment(directStudent.id, course.id),
        group: await helpers.findStudentEnrollment(groupStudent.id, course.id),
      }).toMatchObject({
        direct: { status: COURSE_ENROLLMENT.NOT_ENROLLED, enrolledAt: null },
        group: { status: COURSE_ENROLLMENT.ENROLLED, enrolledByGroupId: group.id },
      });
    });

    const arrangeUnenrollmentRejection = async (
      admin: SignedInUser,
      courseId: UUIDType,
      rejection: UnenrollmentRejection,
    ): Promise<UUIDType> => {
      const student = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);

      await match(rejection)
        .with(UNENROLLMENT_REJECTIONS.NEVER_ENROLLED, async () => undefined)
        .with(UNENROLLMENT_REJECTIONS.ALREADY_UNENROLLED, async () => {
          await enrollStudents(admin, courseId, [student.id]);
          await unenrollStudents(admin, courseId, [student.id]);
        })
        .with(UNENROLLMENT_REJECTIONS.ENROLLED_BY_GROUP, async () => {
          const group = await helpers.arrangeGroupWithMembers([student.id]);
          await enrollGroup(admin, courseId, group.id);
        })
        .exhaustive();

      return student.id;
    };

    it.each(UNENROLLMENT_REJECTION_CASES)(
      "rejects the unenrollment when $rejection",
      async ({ rejection, expectedBody }) => {
        const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const { course } = await arrangeCourse(admin.user.id);
        const studentId = await arrangeUnenrollmentRejection(admin, course.id, rejection);
        const enrollmentBefore = await helpers.findStudentEnrollment(studentId, course.id);

        const response = await unenrollStudents(admin, course.id, [studentId], 400);

        expect(response.body).toMatchObject(expectedBody);
        expect(await helpers.findStudentEnrollment(studentId, course.id)).toEqual(enrollmentBefore);
      },
    );
  });
});
