import {
  COURSE_ARCHIVED_QUERY_VALUES,
  COURSE_STATUSES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { CourseDurationService } from "src/courses/duration/course-duration.service";
import { COURSE_ENROLLMENT_SCOPES } from "src/courses/schemas/courseQuery";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { chapters, courses, lessons } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import {
  createGroupCourseFactory,
  createGroupManagerGroupFactory,
} from "../../../test/factory/group-course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { createCourseEnrollmentHelpers } from "../../../test/helpers/course-enrollment";
import {
  COURSE_LISTING_TABLES,
  createCourseListingHelpers,
} from "../../../test/helpers/course-listing";
import { addSystemRoleToUserInTests } from "../../../test/helpers/permission-role-helpers";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";
import { waitForOutbox } from "../../../test/helpers/wait-for-outbox";

import {
  ALL_COURSES_FILTER_CASES,
  ALL_COURSES_VISIBILITY_CASES,
  AUTHOR_COURSE_SCOPE_CASES,
  AUTHOR_COURSES,
  AUTHOR_FIXTURE,
  CATEGORY_LANGUAGE_CASES,
  ENGLISH_CATEGORY_TITLE,
  ENROLLED_AUTHOR_COURSE_DETAILS,
  FILTER_COURSE_FIXTURES,
  LIST_ORDERS,
  LISTED_DURATION_MINUTES,
  LONG_LESSON_ESTIMATE_SECONDS,
  LONG_LESSON_WORD_COUNT,
  MANAGEMENT_VIEWERS,
  POLISH_CATEGORY_TITLE,
  SHORT_LESSON_DESCRIPTION,
  SHORT_LESSON_ESTIMATE_SECONDS,
  OTHER_AUTHOR_VISIBILITY_COURSE_FIXTURES,
  VISIBILITY_COURSES,
} from "./course-management-list.scenarios";

import type { AuthorCourse, ManagementViewer } from "./course-management-list.scenarios";
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

const bunnyStreamServiceMock = {
  getUrl: jest.fn(),
  isConfigured: jest.fn(),
};

describe("Course management listings (e2e)", () => {
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
        { provide: BunnyStreamService, useValue: bunnyStreamServiceMock },
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
    Object.values(s3ServiceMock).forEach((mock) => mock.mockReset());
    Object.values(bunnyStreamServiceMock).forEach((mock) => mock.mockReset());
    cacheManagerMock.get.mockResolvedValue("");
    cacheManagerMock.set.mockResolvedValue("");
    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `${SIGNED_STORAGE_URL_PREFIX}${key}`,
    );
    bunnyStreamServiceMock.isConfigured.mockResolvedValue(false);
    bunnyStreamServiceMock.getUrl.mockResolvedValue("");

    await enrollmentHelpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_LISTING_TABLES);
  });

  const keysOfListedCourses = <CourseKey extends string>(
    listedCourses: Array<{ id: UUIDType }>,
    courseIdsByKey: Record<CourseKey, UUIDType>,
  ) => {
    const courseKeyById = new Map(
      Object.entries<UUIDType>(courseIdsByKey).map(([courseKey, courseId]) => [
        courseId,
        courseKey,
      ]),
    );

    return listedCourses.map(({ id }) => courseKeyById.get(id));
  };

  const listAllCourses = (viewer: SignedInUser, query: Record<string, string | number> = {}) =>
    request(app.getHttpServer())
      .get("/api/course/all")
      .query(query)
      .set("Cookie", viewer.cookies)
      .expect(200);

  const listAuthorCourses = (viewer: SignedInUser, query: Record<string, string>) =>
    request(app.getHttpServer())
      .get("/api/course/content-creator-courses")
      .query(query)
      .set("Cookie", viewer.cookies)
      .expect(200);

  describe("GET /api/course/all", () => {
    const arrangeManagementViewer = (viewer: ManagementViewer): Promise<SignedInUser> =>
      match(viewer)
        .with(MANAGEMENT_VIEWERS.ADMIN, () =>
          enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN),
        )
        .with(MANAGEMENT_VIEWERS.CONTENT_CREATOR, () =>
          enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
        )
        .with(MANAGEMENT_VIEWERS.CONTENT_CREATOR_WITH_ADMIN_ROLE, async () => {
          const contentCreator = await enrollmentHelpers.arrangeUser(
            SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
          );
          await runInTenant(() =>
            addSystemRoleToUserInTests(
              db,
              contentCreator.id,
              contentCreator.tenantId,
              SYSTEM_ROLE_SLUGS.ADMIN,
            ),
          );

          return { user: contentCreator, cookies: await cookieFor(contentCreator, app) };
        })
        .with(MANAGEMENT_VIEWERS.STUDENT, () =>
          enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT),
        )
        .with(MANAGEMENT_VIEWERS.STUDENT_GROUP_MANAGER, async () => {
          const student = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
          await runInTenant(() =>
            addSystemRoleToUserInTests(
              db,
              student.id,
              student.tenantId,
              SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
            ),
          );

          return { user: student, cookies: await cookieFor(student, app) };
        })
        .exhaustive();

    const arrangeVisibilityCourses = async (viewerId: UUIDType, managesAssignedGroup: boolean) => {
      const otherAuthor = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const viewerAuthoredCourse = await listingHelpers.arrangeCourse({ authorId: viewerId });
      const courseIdsByKey = {
        ...(await listingHelpers.arrangeCoursesByKey(OTHER_AUTHOR_VISIBILITY_COURSE_FIXTURES, {
          authorId: otherAuthor.id,
        })),
        [VISIBILITY_COURSES.VIEWER_AUTHORED]: viewerAuthoredCourse.id,
      };

      await listingHelpers.arrangeEnrollment(
        viewerId,
        courseIdsByKey[VISIBILITY_COURSES.ENROLLED_PRIVATE],
      );
      await runInTenant(async () => {
        const group = await createGroupFactory(db).create();
        await createGroupCourseFactory(db).create({
          groupId: group.id,
          courseId: courseIdsByKey[VISIBILITY_COURSES.MANAGED_GROUP_DRAFT],
        });
        if (managesAssignedGroup) {
          await createGroupManagerGroupFactory(db).create({
            managerUserId: viewerId,
            groupId: group.id,
          });
        }
      });

      return courseIdsByKey;
    };

    it("rejects anonymous visitors", async () => {
      await request(app.getHttpServer()).get("/api/course/all").expect(401);
    });

    it.each(ALL_COURSES_VISIBILITY_CASES)(
      "lists to a $viewer the courses within their access",
      async ({ viewer, managesAssignedGroup, expectedCourses }) => {
        const signedInViewer = await arrangeManagementViewer(viewer);
        const courseIdsByKey = await arrangeVisibilityCourses(
          signedInViewer.user.id,
          managesAssignedGroup,
        );

        const response = await listAllCourses(signedInViewer, {
          isArchived: COURSE_ARCHIVED_QUERY_VALUES.ALL,
        });

        expect(keysOfListedCourses(response.body.data, courseIdsByKey).sort()).toEqual(
          [...expectedCourses].sort(),
        );
      },
    );

    it("describes the author's own courses for a content creator", async () => {
      const contentCreator = await enrollmentHelpers.arrangeSignedInUser(
        SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      );
      const course = await listingHelpers.arrangeCourse({ authorId: contentCreator.user.id });

      const response = await listAllCourses(contentCreator);

      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: course.id,
          title: course.title,
          author: `${contentCreator.user.firstName} ${contentCreator.user.lastName}`,
        }),
      ]);
    });

    it("signs the course thumbnail", async () => {
      const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await listingHelpers.arrangeCourse({
        authorId: admin.user.id,
        thumbnailS3Key: "course-thumbnails/listed.png",
      });

      const response = await listAllCourses(admin);

      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: course.id,
          thumbnailUrl: expect.stringContaining(SIGNED_STORAGE_URL_PREFIX),
        }),
      ]);
    });

    describe("filtering, sorting and paging", () => {
      const arrangeFilterCourses = (authorId: UUIDType) =>
        listingHelpers.arrangeCoursesByKey(FILTER_COURSE_FIXTURES, { authorId });

      it.each(ALL_COURSES_FILTER_CASES)(
        "$description",
        async ({ query, order, expectedCourses, expectedTotal }) => {
          const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
          const courseIdsByKey = await arrangeFilterCourses(admin.user.id);

          const response = await listAllCourses(admin, query);
          const listedCourses = keysOfListedCourses(response.body.data, courseIdsByKey);

          expect(response.body.pagination).toMatchObject({ totalItems: expectedTotal });
          match(order)
            .with(LIST_ORDERS.EXACT, () => expect(listedCourses).toEqual(expectedCourses))
            .with(LIST_ORDERS.ANY, () =>
              expect(listedCourses.sort()).toEqual([...expectedCourses].sort()),
            )
            .exhaustive();
        },
      );

      it("reports the requested page in the pagination", async () => {
        const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        await arrangeFilterCourses(admin.user.id);

        const response = await listAllCourses(admin, { page: 2, perPage: 2 });

        expect(response.body.pagination).toEqual({ totalItems: 3, page: 2, perPage: 2 });
      });

      it.each(CATEGORY_LANGUAGE_CASES)(
        "$description",
        async ({ language, categoryFilter, expectedCategories }) => {
          const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
          const category = await listingHelpers.arrangeLocalizedCategory({
            [SUPPORTED_LANGUAGES.EN]: ENGLISH_CATEGORY_TITLE,
            [SUPPORTED_LANGUAGES.PL]: POLISH_CATEGORY_TITLE,
          });
          await listingHelpers.arrangeCourse({ authorId: admin.user.id, categoryId: category.id });

          const response = await listAllCourses(admin, {
            language,
            ...(categoryFilter && { category: categoryFilter }),
          });

          expect(response.body.data.map((course: { category: string }) => course.category)).toEqual(
            expectedCategories,
          );
        },
      );
    });
  });

  describe("GET /api/course/content-creator-courses", () => {
    const arrangeAuthorCourses = async (viewerId: UUIDType) => {
      const author = await runInTenant(() =>
        createUserFactory(db).create({
          ...AUTHOR_FIXTURE,
          roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        }),
      );
      const otherAuthor = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);

      const enrolledCourse = await listingHelpers.arrangeCourse({
        ...ENROLLED_AUTHOR_COURSE_DETAILS,
        authorId: author.id,
      });
      await runInTenant(() =>
        createChapterFactory(db).create({
          courseId: enrolledCourse.id,
          authorId: author.id,
          isFreemium: true,
        }),
      );
      await listingHelpers.arrangeEnrollment(viewerId, enrolledCourse.id);

      const courseIdsByKey: Record<AuthorCourse, UUIDType> = {
        [AUTHOR_COURSES.ENROLLED]: enrolledCourse.id,
        [AUTHOR_COURSES.AVAILABLE]: (await listingHelpers.arrangeCourse({ authorId: author.id }))
          .id,
        [AUTHOR_COURSES.DRAFT]: (
          await listingHelpers.arrangeCourse({ authorId: author.id, status: COURSE_STATUSES.DRAFT })
        ).id,
        [AUTHOR_COURSES.OTHER_AUTHOR]: (
          await listingHelpers.arrangeCourse({ authorId: otherAuthor.id })
        ).id,
      };

      return { author, courseIdsByKey };
    };

    it.each(AUTHOR_COURSE_SCOPE_CASES)(
      "$description",
      async ({ scope, excludedCourse, expectedCourses }) => {
        const student = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
        const { author, courseIdsByKey } = await arrangeAuthorCourses(student.user.id);

        const response = await listAuthorCourses(student, {
          authorId: author.id,
          ...(scope && { scope }),
          ...(excludedCourse && { excludeCourseId: courseIdsByKey[excludedCourse] }),
        });

        const listedCourses = response.body.data.map(
          (course: { id: UUIDType; enrolled: boolean }) => ({
            course: keysOfListedCourses([course], courseIdsByKey)[0],
            enrolled: course.enrolled,
          }),
        );

        expect(listedCourses).toHaveLength(expectedCourses.length);
        expect(listedCourses).toEqual(expect.arrayContaining(expectedCourses));
      },
    );

    it("describes each course with its author, chapters and price", async () => {
      const student = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { author, courseIdsByKey } = await arrangeAuthorCourses(student.user.id);

      const response = await listAuthorCourses(student, {
        authorId: author.id,
        scope: COURSE_ENROLLMENT_SCOPES.ENROLLED,
      });

      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: courseIdsByKey[AUTHOR_COURSES.ENROLLED],
          author: `${AUTHOR_FIXTURE.firstName} ${AUTHOR_FIXTURE.lastName}`,
          authorEmail: AUTHOR_FIXTURE.email,
          authorId: author.id,
          courseChapterCount: ENROLLED_AUTHOR_COURSE_DETAILS.chapterCount,
          hasFreeChapters: true,
          priceInCents: ENROLLED_AUTHOR_COURSE_DETAILS.priceInCents,
          currency: ENROLLED_AUTHOR_COURSE_DETAILS.currency,
        }),
      ]);
    });

    it("counts enrolled participants the same way as the course statistics", async () => {
      const admin = await enrollmentHelpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const author = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const course = await listingHelpers.arrangeCourse({ authorId: author.id });
      await listingHelpers.arrangeCourseSummaryStats({
        courseId: course.id,
        authorId: author.id,
        freePurchasedCount: 99,
        paidPurchasedCount: 99,
      });
      for (let learnerIndex = 0; learnerIndex < 2; learnerIndex += 1) {
        const learner = await enrollmentHelpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
        await listingHelpers.arrangeEnrollment(learner.id, course.id);
      }

      const listingResponse = await listAuthorCourses(admin, {
        authorId: author.id,
        language: SUPPORTED_LANGUAGES.EN,
      });
      const statisticsResponse = await request(app.getHttpServer())
        .get(`/api/course/${course.id}/statistics`)
        .set("Cookie", admin.cookies)
        .expect(200);

      expect(statisticsResponse.body.data).toMatchObject({ enrolledCount: 2 });
      expect(listingResponse.body.data).toEqual([
        expect.objectContaining({ id: course.id, enrolledParticipantCount: 2 }),
      ]);
    });

    describe("duration estimates", () => {
      const arrangeCourseWithContentLesson = async (author: SignedInUser) => {
        const course = await listingHelpers.arrangeCourse({
          authorId: author.user.id,
          chapterCount: 1,
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
        });

        return runInTenant(async () => {
          const chapter = await createChapterFactory(db).create({
            courseId: course.id,
            authorId: author.user.id,
            lessonCount: 1,
          });
          const lesson = await createLessonFactory(db).create({
            chapterId: chapter.id,
            description: { [SUPPORTED_LANGUAGES.EN]: SHORT_LESSON_DESCRIPTION },
          });
          await app.get(CourseDurationService).refreshCourseDurationEstimates(course.id);

          return { course, chapter, lesson };
        });
      };

      const findDurationEstimates = (courseId: UUIDType, chapterId: UUIDType, lessonId: UUIDType) =>
        runInTenant(async () => {
          const [course] = await db
            .select({ durationEstimates: courses.durationEstimates })
            .from(courses)
            .where(eq(courses.id, courseId));
          const [chapter] = await db
            .select({ durationEstimates: chapters.durationEstimates })
            .from(chapters)
            .where(eq(chapters.id, chapterId));
          const [lesson] = await db
            .select({ durationEstimates: lessons.durationEstimates })
            .from(lessons)
            .where(eq(lessons.id, lessonId));

          return { course, chapter, lesson };
        });

      const estimatesInEveryLanguage = (totalSeconds: number) => ({
        durationEstimates: {
          [SUPPORTED_LANGUAGES.EN]: { totalSeconds },
          [SUPPORTED_LANGUAGES.PL]: { totalSeconds },
        },
      });

      const longLessonDescription = Array.from(
        { length: LONG_LESSON_WORD_COUNT },
        () => "word",
      ).join(" ");

      it("stores per-language estimates for the course, its chapters and lessons", async () => {
        const author = await enrollmentHelpers.arrangeSignedInUser(
          SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        );
        const { course, chapter, lesson } = await arrangeCourseWithContentLesson(author);

        const response = await listAuthorCourses(author, {
          authorId: author.user.id,
          language: SUPPORTED_LANGUAGES.EN,
        });

        expect(response.body.data).toEqual([
          expect.objectContaining({
            id: course.id,
            estimatedDurationMinutes: LISTED_DURATION_MINUTES,
          }),
        ]);
        expect(await findDurationEstimates(course.id, chapter.id, lesson.id)).toEqual({
          course: estimatesInEveryLanguage(SHORT_LESSON_ESTIMATE_SECONDS),
          chapter: estimatesInEveryLanguage(SHORT_LESSON_ESTIMATE_SECONDS),
          lesson: estimatesInEveryLanguage(SHORT_LESSON_ESTIMATE_SECONDS),
        });
      });

      it("lists the stored estimate until a lesson update refreshes it", async () => {
        const author = await enrollmentHelpers.arrangeSignedInUser(
          SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        );
        const { course, chapter, lesson } = await arrangeCourseWithContentLesson(author);
        await runInTenant(() =>
          db
            .update(lessons)
            .set({ description: buildJsonbField(SUPPORTED_LANGUAGES.EN, longLessonDescription) })
            .where(eq(lessons.id, lesson.id)),
        );

        const staleResponse = await listAuthorCourses(author, {
          authorId: author.user.id,
          language: SUPPORTED_LANGUAGES.EN,
        });
        await request(app.getHttpServer())
          .patch("/api/lesson/beta-update-lesson")
          .query({ id: lesson.id })
          .set("Cookie", author.cookies)
          .send({ language: SUPPORTED_LANGUAGES.EN, description: longLessonDescription })
          .expect(200);
        await waitForOutbox(
          app,
          () => findDurationEstimates(course.id, chapter.id, lesson.id),
          (estimates) =>
            estimates.course.durationEstimates[SUPPORTED_LANGUAGES.EN]?.totalSeconds ===
            LONG_LESSON_ESTIMATE_SECONDS,
          15000,
          50,
        );
        const refreshedResponse = await listAuthorCourses(author, {
          authorId: author.user.id,
          language: SUPPORTED_LANGUAGES.EN,
        });

        expect(staleResponse.body.data).toEqual([
          expect.objectContaining({ estimatedDurationMinutes: LISTED_DURATION_MINUTES }),
        ]);
        expect(refreshedResponse.body.data).toEqual([
          expect.objectContaining({ estimatedDurationMinutes: LISTED_DURATION_MINUTES }),
        ]);
        expect(await findDurationEstimates(course.id, chapter.id, lesson.id)).toEqual({
          course: estimatesInEveryLanguage(LONG_LESSON_ESTIMATE_SECONDS),
          chapter: estimatesInEveryLanguage(LONG_LESSON_ESTIMATE_SECONDS),
          lesson: estimatesInEveryLanguage(LONG_LESSON_ESTIMATE_SECONDS),
        });
      });
    });
  });
});
