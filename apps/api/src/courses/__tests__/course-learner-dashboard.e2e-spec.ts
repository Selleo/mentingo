import { ENTITY_TYPES, SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";

import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createResourceFactory } from "../../../test/factory/resource.factory";
import { createCourseEnrollmentHelpers } from "../../../test/helpers/course-enrollment";
import {
  COURSE_LISTING_TABLES,
  createCourseListingHelpers,
} from "../../../test/helpers/course-listing";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  COURSE_TRAILER_REFERENCE,
  LEARNER_COURSE_FIXTURES,
  LEARNER_COURSE_QUERY_CASES,
  LEARNER_COURSE_VISIBILITY_CASES,
  PROGRESS_CHAPTER_COUNT,
  PROGRESS_COURSE_FIXTURES,
  PROGRESS_COURSES,
} from "./course-learner-dashboard.scenarios";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const SIGNED_STORAGE_URL_PREFIX = "https://storage.test/signed/";

const cacheManagerMock = {
  get: jest.fn(),
  set: jest.fn(),
};

const s3ServiceMock = {
  getSignedUrl: jest.fn(),
};

describe("Course learner dashboard (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let enrollmentHelpers: ReturnType<typeof createCourseEnrollmentHelpers>;
  let listingHelpers: ReturnType<typeof createCourseListingHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: "CACHE_MANAGER", useValue: cacheManagerMock },
        { provide: S3Service, useValue: s3ServiceMock },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    enrollmentHelpers = createCourseEnrollmentHelpers({ app, db, runInTenant });
    listingHelpers = createCourseListingHelpers({ db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_LISTING_TABLES);

    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());
    s3ServiceMock.getSignedUrl.mockReset();
    cacheManagerMock.get.mockResolvedValue("");
    cacheManagerMock.set.mockResolvedValue("");
    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `${SIGNED_STORAGE_URL_PREFIX}${key}`,
    );

    await enrollmentHelpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_LISTING_TABLES);
  });

  const arrangeLearnerWithAuthor = async () => ({
    learner: await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT),
    author: await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
  });

  const enrollInEveryCourse = async (
    learnerId: UUIDType,
    courseIdsByKey: Record<string, UUIDType>,
  ) => {
    for (const courseId of Object.values(courseIdsByKey)) {
      await listingHelpers.arrangeEnrollment(learnerId, courseId);
    }
  };

  const arrangeProgressCourses = async (learnerId: UUIDType, authorId: UUIDType) => {
    for (const { title, progress, finishedChapterCount, completed } of Object.values(
      PROGRESS_COURSE_FIXTURES,
    )) {
      const course = await listingHelpers.arrangeCourse({
        title,
        authorId,
        chapterCount: PROGRESS_CHAPTER_COUNT,
      });
      await listingHelpers.arrangeEnrollment(learnerId, course.id, {
        progress,
        finishedChapterCount,
        completedAt: completed ? new Date().toISOString() : null,
      });
    }
  };

  const listLearnerCourses = (learner: SignedInUser, query: Record<string, string | number> = {}) =>
    request(app.getHttpServer())
      .get("/api/course/get-student-courses")
      .query(query)
      .set("Cookie", learner.cookies)
      .expect(200);

  describe("GET /api/course/get-student-courses", () => {
    it("rejects anonymous visitors", async () => {
      await request(app.getHttpServer()).get("/api/course/get-student-courses").expect(401);
    });

    it.each(LEARNER_COURSE_VISIBILITY_CASES)(
      "lists a $status course: $listed when enrolled: $enrolled",
      async ({ status, enrolled, listed }) => {
        const { learner, author } = await arrangeLearnerWithAuthor();
        const course = await listingHelpers.arrangeCourse({ authorId: author.id, status });
        if (enrolled) await listingHelpers.arrangeEnrollment(learner.user.id, course.id);

        const response = await listLearnerCourses(learner);

        expect(response.body.data.map(({ id }: { id: UUIDType }) => id)).toEqual(
          listed ? [course.id] : [],
        );
      },
    );

    it.each(LEARNER_COURSE_QUERY_CASES)(
      "$description",
      async ({ query, expectedCourses, expectedPagination }) => {
        const { learner, author } = await arrangeLearnerWithAuthor();
        const courseIdsByKey = await listingHelpers.arrangeCoursesByKey(LEARNER_COURSE_FIXTURES, {
          authorId: author.id,
        });
        await enrollInEveryCourse(learner.user.id, courseIdsByKey);

        const response = await listLearnerCourses(learner, query);

        expect(response.body).toMatchObject({
          data: expectedCourses.map((course) => ({ id: courseIdsByKey[course] })),
          pagination: expectedPagination,
        });
        expect(response.body.data).toHaveLength(expectedCourses.length);
      },
    );

    it("places completed courses after in-progress ones, least progressed first", async () => {
      const { learner, author } = await arrangeLearnerWithAuthor();
      await arrangeProgressCourses(learner.user.id, author.id);

      const response = await listLearnerCourses(learner);

      expect(response.body.data.map(({ title }: { title: string }) => title)).toEqual([
        PROGRESS_COURSE_FIXTURES[PROGRESS_COURSES.EARLY_PROGRESS].title,
        PROGRESS_COURSE_FIXTURES[PROGRESS_COURSES.LATE_PROGRESS].title,
        PROGRESS_COURSE_FIXTURES[PROGRESS_COURSES.COMPLETED].title,
      ]);
    });

    it("signs the trailer of an enrolled course", async () => {
      const { learner, author } = await arrangeLearnerWithAuthor();
      const course = await listingHelpers.arrangeCourse({ authorId: author.id });
      await listingHelpers.arrangeEnrollment(learner.user.id, course.id);
      await runInTenant(() =>
        createResourceFactory(db)
          .linkedTo({
            entityId: course.id,
            entityType: ENTITY_TYPES.COURSE,
            relationshipType: RESOURCE_RELATIONSHIP_TYPES.TRAILER,
          })
          .create({
            reference: COURSE_TRAILER_REFERENCE,
            contentType: "video/mp4",
            uploadedBy: author.id,
          }),
      );

      const response = await listLearnerCourses(learner);

      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: course.id,
          trailerUrl: `${SIGNED_STORAGE_URL_PREFIX}${COURSE_TRAILER_REFERENCE}`,
        }),
      ]);
    });
  });

  describe("GET /api/course/dashboard-summary", () => {
    it("offers unfinished courses to continue, least progressed first", async () => {
      const { learner, author } = await arrangeLearnerWithAuthor();
      await arrangeProgressCourses(learner.user.id, author.id);

      const response = await request(app.getHttpServer())
        .get("/api/course/dashboard-summary")
        .query({ language: SUPPORTED_LANGUAGES.EN })
        .set("Cookie", learner.cookies)
        .expect(200);

      expect(
        response.body.data.continueLearningCourses.map(({ title }: { title: string }) => title),
      ).toEqual([
        PROGRESS_COURSE_FIXTURES[PROGRESS_COURSES.EARLY_PROGRESS].title,
        PROGRESS_COURSE_FIXTURES[PROGRESS_COURSES.LATE_PROGRESS].title,
      ]);
    });
  });
});
