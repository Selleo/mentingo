import { faker } from "@faker-js/faker";
import { COURSE_ENROLLMENT, SUPPORTED_LANGUAGES } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { studentCourses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createStudentCourseFactory } from "../../../test/factory/student-course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import {
  AVAILABLE_CATEGORY_CASES,
  AVAILABLE_COURSE_SORT_CASES,
  CATALOG_COURSE_FIXTURES,
  CATALOG_COURSES,
  ENROLLMENT_STATES,
  LESSON_SEQUENCE_CASES,
  MARK_COURSE_OPENED_CASES,
  PUBLISHED_LOOKUP_CASES,
  SORT_EXPECTATIONS,
  TOP_COURSE_CASES,
  TOP_COURSE_ENROLLMENTS,
} from "./course-catalog.scenarios";

import type { CatalogCourse, EnrollmentState } from "./course-catalog.scenarios";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const COURSE_CATALOG_TABLES = [
  "student_courses",
  "lessons",
  "chapters",
  "courses",
  "categories",
  "users",
  "settings",
] as const;

const PASSWORD = "password123";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const s3ServiceMock = {
  getSignedUrl: jest.fn(),
};

type CatalogFixture = {
  courseIdsByKey: Record<CatalogCourse, UUIDType>;
  admin: UserWithCredentials;
  viewer: UserWithCredentials;
  viewerCookies: string;
};

describe("Course catalog (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runAsDefaultTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let studentCourseFactory: ReturnType<typeof createStudentCourseFactory>;
  let fixture: CatalogFixture;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: S3Service, useValue: s3ServiceMock },
        {
          provide: "CACHE_MANAGER",
          useValue: { get: jest.fn().mockResolvedValue(""), set: jest.fn() },
        },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runAsDefaultTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);

    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    studentCourseFactory = createStudentCourseFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, [...COURSE_CATALOG_TABLES]);
    s3ServiceMock.getSignedUrl.mockReset();
    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `https://storage.example.com/${key}`,
    );

    fixture = await runAsDefaultTenant(async () => {
      await settingsFactory.create({ userId: null });
      return arrangeCatalog();
    });
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, [...COURSE_CATALOG_TABLES]);
  });

  const arrangeCatalog = async (): Promise<CatalogFixture> => {
    const admin = await userFactory
      .withCredentials({ password: PASSWORD })
      .withAdminSettings(db)
      .create();
    const viewer = await userFactory
      .withCredentials({ password: PASSWORD })
      .withUserSettings(db)
      .create();

    const courseIdsByKey = {} as Record<CatalogCourse, UUIDType>;
    for (const [courseKey, courseFixture] of Object.entries(CATALOG_COURSE_FIXTURES)) {
      const author = await userFactory.create(courseFixture.author);
      const category = await categoryFactory.create({ title: courseFixture.categoryTitle });
      const course = await courseFactory.create({
        title: courseFixture.title,
        categoryId: category.id,
        authorId: author.id,
        createdAt: courseFixture.createdAt,
        status: courseFixture.status,
        isArchived: courseFixture.isArchived,
        thumbnailS3Key: `course-thumbnails/${courseKey}.png`,
      });
      courseIdsByKey[courseKey as CatalogCourse] = course.id;
    }

    return { courseIdsByKey, admin, viewer, viewerCookies: await cookieFor(viewer, app) };
  };

  const enrollLearner = (studentId: UUIDType, course: CatalogCourse, enrolledDaysAgo = 0) =>
    runAsDefaultTenant(() =>
      studentCourseFactory.create({
        studentId,
        courseId: fixture.courseIdsByKey[course],
        enrolledAt: new Date(Date.now() - enrolledDaysAgo * DAY_IN_MS).toISOString(),
      }),
    );

  const courseKeysOf = (rows: { id: UUIDType }[]) => {
    const courseKeyById = Object.fromEntries(
      Object.entries(fixture.courseIdsByKey).map(([courseKey, courseId]) => [courseId, courseKey]),
    );

    return rows.map(({ id }) => courseKeyById[id]);
  };

  const getAsViewer = (path: string, query: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .get(path)
      .query({ language: SUPPORTED_LANGUAGES.EN, ...query })
      .set("Cookie", fixture.viewerCookies);

  describe("GET /api/course/available-courses", () => {
    it.each(AVAILABLE_COURSE_SORT_CASES)(
      "returns published, unarchived courses sorted by $sort $expectation",
      async ({ sort, expectation, expectedCourses }) => {
        const response = await getAsViewer("/api/course/available-courses", { sort }).expect(200);
        const courseKeys = courseKeysOf(response.body.data);

        match(expectation)
          .with(SORT_EXPECTATIONS.EXACT_ORDER, () => expect(courseKeys).toEqual(expectedCourses))
          .with(SORT_EXPECTATIONS.ANY_ORDER, () =>
            expect([...courseKeys].sort()).toEqual([...expectedCourses].sort()),
          )
          .exhaustive();
      },
    );
  });

  describe("GET /api/course/top-courses", () => {
    beforeEach(async () => {
      for (const { course, enrolledDaysAgo } of TOP_COURSE_ENROLLMENTS) {
        const learner = await runAsDefaultTenant(() => userFactory.create());
        await enrollLearner(learner.id, course, enrolledDaysAgo);
      }
    });

    it.each(TOP_COURSE_CASES)("$description", async ({ query, expectedCourses }) => {
      const response = await getAsViewer("/api/course/top-courses", query).expect(200);

      expect(courseKeysOf(response.body.data)).toEqual(expectedCourses);
    });

    it("skips courses the viewer is already enrolled in", async () => {
      await enrollLearner(fixture.viewer.id, CATALOG_COURSES.BRAVO);

      const response = await getAsViewer("/api/course/top-courses").expect(200);

      expect(courseKeysOf(response.body.data)).toEqual([
        CATALOG_COURSES.CHARLIE,
        CATALOG_COURSES.ALPHA,
      ]);
    });

    it("describes each course with its author, category, slug and signed thumbnail", async () => {
      const response = await getAsViewer("/api/course/top-courses", { limit: 1 }).expect(200);
      const bravo = CATALOG_COURSE_FIXTURES[CATALOG_COURSES.BRAVO];

      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: fixture.courseIdsByKey[CATALOG_COURSES.BRAVO],
          title: bravo.title,
          category: bravo.categoryTitle,
          author: `${bravo.author.firstName} ${bravo.author.lastName}`,
          enrolled: false,
          completedChapterCount: 0,
          lessonCount: 0,
          hasFreeChapters: false,
          dueDate: null,
          trailerUrl: null,
          estimatedDurationMinutes: 0,
          slug: expect.any(String),
          thumbnailUrl: expect.stringMatching(/^https:\/\/storage\.example\.com\//),
        }),
      ]);
    });
  });

  describe("GET /api/course/available-categories", () => {
    it.each(AVAILABLE_CATEGORY_CASES)(
      "$description",
      async ({ viewerEnrolledIn, query, expectedCategories, expectedTotal }) => {
        for (const course of viewerEnrolledIn) {
          await enrollLearner(fixture.viewer.id, course);
        }

        const response = await getAsViewer("/api/course/available-categories", query).expect(200);

        expect(response.body).toMatchObject({
          data: expectedCategories.map((title) => ({ title, createdAt: null })),
          pagination: { totalItems: expectedTotal },
        });
        expect(response.body.data).toHaveLength(expectedCategories.length);
      },
    );
  });

  describe("GET /api/course/published-lookup", () => {
    it.each(PUBLISHED_LOOKUP_CASES)(
      "$description",
      async ({ query, expectedCourses, expectedTotal }) => {
        const response = await request(app.getHttpServer())
          .get("/api/course/published-lookup")
          .query({ language: SUPPORTED_LANGUAGES.EN, ...query })
          .set("Cookie", await cookieFor(fixture.admin, app))
          .expect(200);

        expect(response.body).toEqual({
          data: expectedCourses.map((course) => ({
            id: fixture.courseIdsByKey[course],
            title: CATALOG_COURSE_FIXTURES[course].title,
          })),
          pagination: expect.objectContaining({ totalItems: expectedTotal }),
        });
      },
    );

    it("is forbidden for learners", async () => {
      await getAsViewer("/api/course/published-lookup").expect(403);
    });
  });

  describe("GET /api/course/lesson-sequence-enabled/:courseId", () => {
    it.each(LESSON_SEQUENCE_CASES)(
      "returns lessonSequenceEnabled=$lessonSequenceEnabled from the course settings",
      async ({ lessonSequenceEnabled }) => {
        const { settings } = courseFactory.build();
        const course = await runAsDefaultTenant(() =>
          courseFactory.create({ settings: { ...settings, lessonSequenceEnabled } }),
        );

        const response = await getAsViewer(
          `/api/course/lesson-sequence-enabled/${course.id}`,
        ).expect(200);

        expect(response.body).toEqual({ data: { lessonSequenceEnabled } });
      },
    );

    it("returns not found for an unknown course", async () => {
      const response = await getAsViewer(
        `/api/course/lesson-sequence-enabled/${faker.string.uuid()}`,
      ).expect(404);

      expect(response.body.message).toBe("adminCourseView.errors.notFound.course");
    });
  });

  describe("POST /api/course/:courseId/open", () => {
    const arrangeViewerEnrollment = (enrollmentState: EnrollmentState) =>
      match(enrollmentState)
        .with(ENROLLMENT_STATES.ENROLLED, () =>
          enrollLearner(fixture.viewer.id, CATALOG_COURSES.ALPHA),
        )
        .with(ENROLLMENT_STATES.NOT_ENROLLED, () =>
          runAsDefaultTenant(() =>
            studentCourseFactory.create({
              studentId: fixture.viewer.id,
              courseId: fixture.courseIdsByKey[CATALOG_COURSES.ALPHA],
              status: COURSE_ENROLLMENT.NOT_ENROLLED,
            }),
          ),
        )
        .with(ENROLLMENT_STATES.NONE, async () => null)
        .exhaustive();

    const findViewerEnrollment = () =>
      runAsDefaultTenant(async () => {
        const [enrollment] = await db
          .select({ lastOpenedAt: studentCourses.lastOpenedAt })
          .from(studentCourses)
          .where(
            and(
              eq(studentCourses.studentId, fixture.viewer.id),
              eq(studentCourses.courseId, fixture.courseIdsByKey[CATALOG_COURSES.ALPHA]),
            ),
          );

        return enrollment ?? null;
      });

    it.each(MARK_COURSE_OPENED_CASES)(
      "responds $expectedStatus for a $enrollmentState learner",
      async ({ enrollmentState, expectedStatus }) => {
        await arrangeViewerEnrollment(enrollmentState);

        await request(app.getHttpServer())
          .post(`/api/course/${fixture.courseIdsByKey[CATALOG_COURSES.ALPHA]}/open`)
          .set("Cookie", fixture.viewerCookies)
          .expect(expectedStatus);

        const enrollment = await findViewerEnrollment();

        match(enrollmentState)
          .with(ENROLLMENT_STATES.ENROLLED, () =>
            expect(enrollment).toEqual({ lastOpenedAt: expect.any(String) }),
          )
          .with(ENROLLMENT_STATES.NOT_ENROLLED, () =>
            expect(enrollment).toEqual({ lastOpenedAt: null }),
          )
          .with(ENROLLMENT_STATES.NONE, () => expect(enrollment).toBeNull())
          .exhaustive();
      },
    );
  });
});
