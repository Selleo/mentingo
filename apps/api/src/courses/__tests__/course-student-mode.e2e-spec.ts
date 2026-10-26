import { faker } from "@faker-js/faker";
import { COURSE_ENROLLMENT, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  COURSE_ENROLLMENT_TABLES,
  createCourseEnrollmentHelpers,
} from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  COURSE_AUTHORSHIPS,
  STUDENT_MODE_ALLOWED_CASES,
  STUDENT_MODE_COURSE_CONTENT,
  STUDENT_MODE_FORBIDDEN_ROLES,
} from "./course-student-mode.scenarios";

import type { CourseAuthorship } from "./course-student-mode.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const cacheManagerMock = {
  get: jest.fn(),
  set: jest.fn(),
};

describe("Course student mode (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let helpers: ReturnType<typeof createCourseEnrollmentHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: "CACHE_MANAGER", useValue: cacheManagerMock }],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    helpers = createCourseEnrollmentHelpers({
      app,
      db,
      runInTenant: (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn),
    });
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

  const setStudentMode = (
    signedInUser: SignedInUser,
    courseId: UUIDType,
    enabled: boolean,
    expectedStatus = 200,
  ) =>
    request(app.getHttpServer())
      .patch(`/api/course/${courseId}/student-mode`)
      .set("Cookie", signedInUser.cookies)
      .send({ enabled })
      .expect(expectedStatus);

  const resolveCourseAuthorId = async (
    signedInUser: SignedInUser,
    authorship: CourseAuthorship,
  ): Promise<UUIDType> =>
    match(authorship)
      .with(COURSE_AUTHORSHIPS.OWN, async () => signedInUser.user.id)
      .with(COURSE_AUTHORSHIPS.OTHER_AUTHOR, async () => {
        const otherAuthor = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
        return otherAuthor.id;
      })
      .exhaustive();

  describe("PATCH /api/course/:courseId/student-mode", () => {
    it.each(STUDENT_MODE_ALLOWED_CASES)(
      "lets $role enable student mode on $authorship",
      async ({ role, authorship }) => {
        const signedInUser = await helpers.arrangeSignedInUser(role);
        const { course } = await helpers.arrangeCourseWithContent({
          authorId: await resolveCourseAuthorId(signedInUser, authorship),
          contentShape: STUDENT_MODE_COURSE_CONTENT,
        });

        const response = await setStudentMode(signedInUser, course.id, true);

        expect(response.body.data).toEqual({
          courseId: course.id,
          enabled: true,
          studentModeCourseIds: [course.id],
        });
      },
    );

    it.each(STUDENT_MODE_FORBIDDEN_ROLES)(
      "forbids $role from changing student mode",
      async ({ role }) => {
        const signedInUser = await helpers.arrangeSignedInUser(role);
        const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
        const { course } = await helpers.arrangeCourseWithContent({
          authorId: author.id,
          contentShape: STUDENT_MODE_COURSE_CONTENT,
        });

        await setStudentMode(signedInUser, course.id, true, 403);

        expect(await helpers.findStudentModeCourseIds(signedInUser.user.id)).toEqual([]);
      },
    );

    it("returns not found for a course that does not exist", async () => {
      const contentCreator = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);

      const response = await setStudentMode(contentCreator, faker.string.uuid(), true, 404);

      expect(response.body).toMatchObject({
        message: "adminCourseView.errors.notFound.course",
      });
    });

    it("enrolls the user and prepares course progress when enabling student mode", async () => {
      const contentCreator = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const { course, chapters } = await helpers.arrangeCourseWithContent({
        authorId: contentCreator.user.id,
        contentShape: STUDENT_MODE_COURSE_CONTENT,
      });
      const [chapterWithLessons, chapterWithoutLessons] = chapters;
      const [quizLesson, contentLesson] = chapterWithLessons.lessons;

      await setStudentMode(contentCreator, course.id, true);

      expect(await helpers.findStudentEnrollment(contentCreator.user.id, course.id)).toEqual({
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: expect.any(String),
        enrolledByGroupId: null,
        paymentId: null,
      });
      expect(await helpers.findStudentCourseProgress(contentCreator.user.id, course.id)).toEqual({
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

    it("keeps a single student mode entry when enabled twice", async () => {
      const contentCreator = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const { course } = await helpers.arrangeCourseWithContent({
        authorId: contentCreator.user.id,
        contentShape: STUDENT_MODE_COURSE_CONTENT,
      });

      await setStudentMode(contentCreator, course.id, true);
      const response = await setStudentMode(contentCreator, course.id, true);

      expect(response.body.data.studentModeCourseIds).toEqual([course.id]);
      expect(await helpers.findStudentModeCourseIds(contentCreator.user.id)).toEqual([course.id]);
    });

    it("disables student mode but keeps the enrollment", async () => {
      const contentCreator = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const { course } = await helpers.arrangeCourseWithContent({
        authorId: contentCreator.user.id,
        contentShape: STUDENT_MODE_COURSE_CONTENT,
      });

      await setStudentMode(contentCreator, course.id, true);
      const response = await setStudentMode(contentCreator, course.id, false);

      expect(response.body.data).toEqual({
        courseId: course.id,
        enabled: false,
        studentModeCourseIds: [],
      });
      expect(await helpers.findStudentEnrollment(contentCreator.user.id, course.id)).toMatchObject({
        status: COURSE_ENROLLMENT.ENROLLED,
      });
    });

    it("lists every course the user has in student mode", async () => {
      const contentCreator = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const { course: firstCourse } = await helpers.arrangeCourseWithContent({
        authorId: contentCreator.user.id,
        contentShape: STUDENT_MODE_COURSE_CONTENT,
      });
      const { course: secondCourse } = await helpers.arrangeCourseWithContent({
        authorId: contentCreator.user.id,
        contentShape: STUDENT_MODE_COURSE_CONTENT,
      });

      await setStudentMode(contentCreator, firstCourse.id, true);
      const response = await setStudentMode(contentCreator, secondCourse.id, true);

      expect(response.body.data.studentModeCourseIds).toHaveLength(2);
      expect(response.body.data.studentModeCourseIds).toEqual(
        expect.arrayContaining([firstCourse.id, secondCourse.id]),
      );
    });

    it("does not list student mode courses of other users", async () => {
      const contentCreator = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { course } = await helpers.arrangeCourseWithContent({
        authorId: contentCreator.user.id,
        contentShape: STUDENT_MODE_COURSE_CONTENT,
      });

      await setStudentMode(admin, course.id, true);
      const response = await setStudentMode(contentCreator, course.id, false);

      expect(response.body.data.studentModeCourseIds).toEqual([]);
      expect(await helpers.findStudentModeCourseIds(admin.user.id)).toEqual([course.id]);
    });
  });
});
