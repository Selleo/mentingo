import {
  COURSE_ENROLLMENT,
  COURSE_STATUSES,
  ENTITY_TYPES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq, isNull, sql } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courses, lessons, settings } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createAiMentorLessonFactory } from "../../../test/factory/ai-mentor-lesson.factory";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import {
  createGroupCourseFactory,
  createGroupManagerGroupFactory,
} from "../../../test/factory/group-course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createResourceFactory } from "../../../test/factory/resource.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createStudentCourseFactory } from "../../../test/factory/student-course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import {
  addSystemRoleToUserInTests,
  assignSystemRoleToUserInTests,
} from "../../../test/helpers/permission-role-helpers";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import {
  BETA_COURSE_ACCESS_CASES,
  BETA_COURSE_OUTCOMES,
  BUNNY_PLAYBACK_URL_PREFIX,
  COURSE_DETAIL_ACCESS_CASES,
  COURSE_DETAIL_OUTCOMES,
  COURSE_LOOKUP_CASES,
  COURSE_LOOKUP_OUTCOMES,
  COURSE_STATES,
  COURSE_TITLE_LANGUAGE_CASES,
  COURSE_VIEWERS,
  LESSON_FILE_CASES,
  LESSON_FILE_URLS,
  MANAGER_PREVIEW_CASES,
  MANAGER_SCOPES,
  SIGNED_STORAGE_URL_PREFIX,
  TITLE_TRANSLATIONS,
  VIDEO_EMBED_CASES,
  VIDEO_EMBED_RESULTS,
} from "./course-detail-access.scenarios";

import type {
  CourseDetailOutcome,
  CourseState,
  CourseViewer,
  ManagerScope,
} from "./course-detail-access.scenarios";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const COURSE_DETAIL_TABLES: Parameters<typeof truncateTables>[1] = [
  "ai_mentor_lessons",
  "resource_entity",
  "resources",
  "lessons",
  "chapters",
  "group_manager_groups",
  "group_courses",
  "student_courses",
  "group_users",
  "groups",
  "courses",
  "categories",
  "settings",
  "users",
];

const PASSWORD = "Password123@";

const s3ServiceMock = {
  getSignedUrl: jest.fn(),
};

const bunnyStreamServiceMock = {
  getUrl: jest.fn(),
  isConfigured: jest.fn(),
};

describe("Course detail access (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  let lessonFactory: ReturnType<typeof createLessonFactory>;
  let resourceFactory: ReturnType<typeof createResourceFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let studentCourseFactory: ReturnType<typeof createStudentCourseFactory>;
  let groupCourseFactory: ReturnType<typeof createGroupCourseFactory>;
  let groupManagerGroupFactory: ReturnType<typeof createGroupManagerGroupFactory>;
  let aiMentorLessonFactory: ReturnType<typeof createAiMentorLessonFactory>;
  let seedInTenant: <T>(seed: () => Promise<T>) => Promise<T>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: S3Service, useValue: s3ServiceMock },
        { provide: BunnyStreamService, useValue: bunnyStreamServiceMock },
        {
          provide: "CACHE_MANAGER",
          useValue: { get: jest.fn().mockResolvedValue(""), set: jest.fn() },
        },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    seedInTenant = (seed) => e2e.runAsTenant(e2e.defaultTenantId, seed);

    userFactory = createUserFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
    lessonFactory = createLessonFactory(db);
    resourceFactory = createResourceFactory(db);
    groupFactory = createGroupFactory(db);
    studentCourseFactory = createStudentCourseFactory(db);
    groupCourseFactory = createGroupCourseFactory(db);
    groupManagerGroupFactory = createGroupManagerGroupFactory(db);
    aiMentorLessonFactory = createAiMentorLessonFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_DETAIL_TABLES);
    restoreProviderDoubles();
    await seedInTenant(() => createSettingsFactory(db).create());
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_DETAIL_TABLES);
  });

  const restoreProviderDoubles = () => {
    Object.values(s3ServiceMock).forEach((mock) => mock.mockReset());
    Object.values(bunnyStreamServiceMock).forEach((mock) => mock.mockReset());

    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `${SIGNED_STORAGE_URL_PREFIX}${key}`,
    );
    bunnyStreamServiceMock.isConfigured.mockResolvedValue(false);
    bunnyStreamServiceMock.getUrl.mockImplementation(
      async (videoId: string) => `${BUNNY_PLAYBACK_URL_PREFIX}${videoId}`,
    );
  };

  const setAnonymousCourseAccess = (enabled: boolean) =>
    seedInTenant(() =>
      db
        .update(settings)
        .set({
          settings: sql`jsonb_set(${settings.settings}, '{unregisteredUserCoursesAccessibility}', to_jsonb(${enabled}::boolean))`,
        })
        .where(isNull(settings.userId)),
    );

  const createAdmin = () =>
    seedInTenant(() =>
      userFactory.withCredentials({ password: PASSWORD }).withAdminSettings(db).create(),
    );

  const createContentCreator = () =>
    seedInTenant(() =>
      userFactory.withCredentials({ password: PASSWORD }).withContentCreatorSettings(db).create(),
    );

  const createStudent = () =>
    seedInTenant(() =>
      userFactory.withCredentials({ password: PASSWORD }).withUserSettings(db).create(),
    );

  const createGroupManager = () =>
    seedInTenant(async () => {
      const manager = await userFactory
        .withCredentials({ password: PASSWORD })
        .withUserSettings(db)
        .create();
      await assignSystemRoleToUserInTests(
        db,
        manager.id,
        manager.tenantId,
        SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
      );

      return manager;
    });

  const createTrainer = () =>
    seedInTenant(() =>
      userFactory.withCredentials({ password: PASSWORD }).withTrainerSettings(db).create(),
    );

  const arrangeCourse = (courseState: CourseState, authorId: UUIDType) =>
    seedInTenant(async () => {
      const category = await categoryFactory.create();
      const courseAttributes = match(courseState)
        .with(COURSE_STATES.PUBLISHED, () => ({
          status: COURSE_STATUSES.PUBLISHED,
          isArchived: false,
        }))
        .with(COURSE_STATES.DRAFT, () => ({ status: COURSE_STATUSES.DRAFT, isArchived: false }))
        .with(COURSE_STATES.PRIVATE, () => ({ status: COURSE_STATUSES.PRIVATE, isArchived: false }))
        .with(COURSE_STATES.ARCHIVED, () => ({
          status: COURSE_STATUSES.PUBLISHED,
          isArchived: true,
        }))
        .exhaustive();

      return courseFactory.create({
        ...courseAttributes,
        authorId,
        categoryId: category.id,
        thumbnailS3Key: null,
        chapterCount: 0,
      });
    });

  const arrangeManagedGroup = (managerId: UUIDType, memberIds: UUIDType[] = []) =>
    seedInTenant(async () => {
      const group = await groupFactory.withMembers(memberIds).create();
      await groupManagerGroupFactory.create({ managerUserId: managerId, groupId: group.id });

      return group;
    });

  /** Creates the viewer and the relationships it needs; returns null for anonymous visitors. */
  const arrangeViewer = (
    viewer: CourseViewer,
    courseId: UUIDType,
    courseAuthor: UserWithCredentials,
  ) =>
    seedInTenant(() =>
      match<CourseViewer, Promise<UserWithCredentials | null>>(viewer)
        .with(COURSE_VIEWERS.ADMIN, () => createAdmin())
        .with(COURSE_VIEWERS.COURSE_AUTHOR, async () => courseAuthor)
        .with(COURSE_VIEWERS.OTHER_CONTENT_CREATOR, () => createContentCreator())
        .with(COURSE_VIEWERS.ENROLLED_STUDENT, async () => {
          const student = await createStudent();
          await studentCourseFactory.create({ studentId: student.id, courseId });

          return student;
        })
        .with(COURSE_VIEWERS.STUDENT, () => createStudent())
        .with(COURSE_VIEWERS.MANAGING_GROUP_MANAGER, async () => {
          const manager = await createGroupManager();
          const group = await arrangeManagedGroup(manager.id);
          await groupCourseFactory.create({ groupId: group.id, courseId });

          return manager;
        })
        .with(COURSE_VIEWERS.GROUP_MANAGER, async () => {
          const manager = await createGroupManager();
          await arrangeManagedGroup(manager.id);

          return manager;
        })
        .with(COURSE_VIEWERS.TRAINER, () => createTrainer())
        .with(COURSE_VIEWERS.ANONYMOUS, async () => {
          await setAnonymousCourseAccess(true);

          return null;
        })
        .exhaustive(),
    );

  const arrangeManagerScope = (scope: ManagerScope, courseId: UUIDType) =>
    seedInTenant(async () => {
      const manager = await createGroupManager();

      await match(scope)
        .with(MANAGER_SCOPES.GROUP_COURSE_ASSIGNMENT, async () => {
          const group = await arrangeManagedGroup(manager.id);
          await groupCourseFactory.create({ groupId: group.id, courseId });
        })
        .with(MANAGER_SCOPES.MEMBER_ENROLLMENT, async () => {
          const member = await createStudent();
          await arrangeManagedGroup(manager.id, [member.id]);
          await studentCourseFactory.create({ studentId: member.id, courseId });
        })
        .with(MANAGER_SCOPES.UNRELATED_GROUP, async () => {
          await arrangeManagedGroup(manager.id);
        })
        .with(MANAGER_SCOPES.ENROLLED_LEARNER_MANAGER, async () => {
          await addSystemRoleToUserInTests(
            db,
            manager.id,
            manager.tenantId,
            SYSTEM_ROLE_SLUGS.STUDENT,
          );
          const group = await arrangeManagedGroup(manager.id);
          await groupCourseFactory.create({ groupId: group.id, courseId });
          await studentCourseFactory.create({ studentId: manager.id, courseId });
        })
        .with(MANAGER_SCOPES.CATALOG_LEARNER_MANAGER, async () => {
          await addSystemRoleToUserInTests(
            db,
            manager.id,
            manager.tenantId,
            SYSTEM_ROLE_SLUGS.STUDENT,
          );
          await arrangeManagedGroup(manager.id);
        })
        .exhaustive();

      return manager;
    });

  const setCourseThumbnail = (courseId: UUIDType, thumbnailS3Key: string) =>
    seedInTenant(() => db.update(courses).set({ thumbnailS3Key }).where(eq(courses.id, courseId)));

  const sendAs = async (user: UserWithCredentials | null, path: string) => {
    const pendingRequest = request(app.getHttpServer()).get(path);

    if (user) pendingRequest.set("Cookie", await cookieFor(user, app));

    return pendingRequest;
  };

  const getCourseAs = async (
    user: UserWithCredentials | null,
    idOrSlug: string,
    language: string = SUPPORTED_LANGUAGES.EN,
  ) => sendAs(user, `/api/course?id=${idOrSlug}&language=${language}`);

  const expectCourseDetailOutcome = (
    response: request.Response,
    courseId: UUIDType,
    outcome: CourseDetailOutcome,
  ) =>
    match(outcome)
      .with(COURSE_DETAIL_OUTCOMES.VISIBLE, () => {
        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ id: courseId, isManagerPreview: false });
      })
      .with(COURSE_DETAIL_OUTCOMES.MANAGER_PREVIEW, () => {
        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({ id: courseId, isManagerPreview: true });
      })
      .with(COURSE_DETAIL_OUTCOMES.FORBIDDEN, () => expect(response.status).toBe(403))
      .with(COURSE_DETAIL_OUTCOMES.NOT_FOUND, () => expect(response.status).toBe(404))
      .exhaustive();

  describe("GET /api/course", () => {
    it.each(COURSE_DETAIL_ACCESS_CASES)(
      "$viewer $outcome when the course is $courseState",
      async ({ viewer, courseState, outcome }) => {
        const author = await createContentCreator();
        const course = await arrangeCourse(courseState, author.id);
        const viewingUser = await arrangeViewer(viewer, course.id, author);

        const response = await getCourseAs(viewingUser, course.id);

        expectCourseDetailOutcome(response, course.id, outcome);
      },
    );

    it.each(MANAGER_PREVIEW_CASES)(
      "group manager who $scope $outcome",
      async ({ scope, outcome }) => {
        const author = await createContentCreator();
        const course = await arrangeCourse(COURSE_STATES.PUBLISHED, author.id);
        const manager = await arrangeManagerScope(scope, course.id);

        const response = await getCourseAs(manager, course.id);

        expectCourseDetailOutcome(response, course.id, outcome);
      },
    );

    it.each(COURSE_TITLE_LANGUAGE_CASES)(
      "$viewer reads a missing translation as $titleTranslation",
      async ({ viewer, titleTranslation }) => {
        const author = await createContentCreator();
        const course = await arrangeCourse(COURSE_STATES.PUBLISHED, author.id);
        const viewingUser = await arrangeViewer(viewer, course.id, author);

        const response = await getCourseAs(viewingUser, course.id, SUPPORTED_LANGUAGES.PL);

        const expectedTitle = match(titleTranslation)
          .with(TITLE_TRANSLATIONS.REQUESTED_LANGUAGE_ONLY, () => "")
          .with(TITLE_TRANSLATIONS.BASE_LANGUAGE_FALLBACK, () => course.title)
          .exhaustive();
        expect(response.status).toBe(200);
        expect(response.body.data.title).toBe(expectedTitle);
      },
    );

    it("hides courses from anonymous visitors when public course access is disabled", async () => {
      const author = await createContentCreator();
      const course = await arrangeCourse(COURSE_STATES.PUBLISHED, author.id);
      await setAnonymousCourseAccess(false);

      const response = await getCourseAs(null, course.id);

      expect(response.status).toBe(404);
    });

    it("returns not found for an unknown course", async () => {
      const admin = await createAdmin();

      const response = await getCourseAs(admin, "00000000-0000-4000-8000-000000000000");

      expect(response.status).toBe(404);
    });

    it("falls back to the stored thumbnail reference when signing fails", async () => {
      const author = await createContentCreator();
      const course = await arrangeCourse(COURSE_STATES.PUBLISHED, author.id);
      await setCourseThumbnail(course.id, "course/thumbnail.png");
      s3ServiceMock.getSignedUrl.mockRejectedValue(new Error("storage unavailable"));

      const response = await getCourseAs(author, course.id);

      expect(response.status).toBe(200);
      expect(response.body.data.thumbnailUrl).toBe("course/thumbnail.png");
    });
  });

  describe("GET /api/course/lookup", () => {
    it.each(COURSE_LOOKUP_CASES)(
      "$viewer $outcome when the course is $courseState",
      async ({ viewer, courseState, outcome }) => {
        const author = await createContentCreator();
        const course = await arrangeCourse(courseState, author.id);
        const viewingUser = await arrangeViewer(viewer, course.id, author);

        const response = await sendAs(
          viewingUser,
          `/api/course/lookup?id=${course.id}&language=${SUPPORTED_LANGUAGES.EN}`,
        );

        match(outcome)
          .with(COURSE_LOOKUP_OUTCOMES.FOUND, () => {
            expect(response.status).toBe(200);
            expect(response.body.data).toMatchObject({ status: "found" });
          })
          .with(COURSE_LOOKUP_OUTCOMES.NOT_FOUND, () => expect(response.status).toBe(404))
          .exhaustive();
      },
    );

    it("hides courses from anonymous visitors when public course access is disabled", async () => {
      const author = await createContentCreator();
      const course = await arrangeCourse(COURSE_STATES.PUBLISHED, author.id);
      await setAnonymousCourseAccess(false);

      const response = await sendAs(
        null,
        `/api/course/lookup?id=${course.id}&language=${SUPPORTED_LANGUAGES.EN}`,
      );

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/course/beta-course-by-id", () => {
    const getBetaCourseAs = (user: UserWithCredentials | null, courseId: UUIDType) =>
      sendAs(
        user,
        `/api/course/beta-course-by-id?id=${courseId}&language=${SUPPORTED_LANGUAGES.EN}`,
      );

    const arrangeLessonInCourse = (
      authorId: UUIDType,
      lesson: Parameters<typeof lessonFactory.create>[0],
    ) =>
      seedInTenant(async () => {
        const course = await arrangeCourse(COURSE_STATES.DRAFT, authorId);
        const chapter = await chapterFactory.create({
          authorId,
          courseId: course.id,
          displayOrder: 1,
          lessonCount: 1,
        });
        const createdLesson = await lessonFactory.create({ ...lesson, chapterId: chapter.id });

        return { course, lesson: createdLesson };
      });

    const findBetaLesson = (response: request.Response, lessonId: UUIDType) =>
      response.body.data.chapters
        .flatMap((chapter: { lessons: Array<{ id: UUIDType }> }) => chapter.lessons)
        .find((lesson: { id: UUIDType }) => lesson.id === lessonId);

    it.each(BETA_COURSE_ACCESS_CASES)("$viewer $outcome", async ({ viewer, outcome }) => {
      const author = await createContentCreator();
      const course = await arrangeCourse(COURSE_STATES.DRAFT, author.id);
      const viewingUser = await arrangeViewer(viewer, course.id, author);

      const response = await getBetaCourseAs(viewingUser, course.id);

      match(outcome)
        .with(BETA_COURSE_OUTCOMES.VISIBLE, () => {
          expect(response.status).toBe(200);
          expect(response.body.data).toMatchObject({
            id: course.id,
            title: course.title,
            authorId: author.id,
            status: COURSE_STATUSES.DRAFT,
            thumbnailS3SingedUrl: null,
            trailerUrl: null,
            chapters: [],
          });
        })
        .with(BETA_COURSE_OUTCOMES.FORBIDDEN, () => expect(response.status).toBe(403))
        .with(BETA_COURSE_OUTCOMES.UNAUTHORIZED, () => expect(response.status).toBe(401))
        .exhaustive();
    });

    it("returns not found for an unknown course", async () => {
      const admin = await createAdmin();

      const response = await getBetaCourseAs(admin, "00000000-0000-4000-8000-000000000000");

      expect(response.status).toBe(404);
    });

    it("signs the course thumbnail", async () => {
      const author = await createContentCreator();
      const course = await arrangeCourse(COURSE_STATES.DRAFT, author.id);
      await setCourseThumbnail(course.id, "course/thumbnail.png");

      const response = await getBetaCourseAs(author, course.id);

      expect(response.body.data.thumbnailS3SingedUrl).toBe(
        `${SIGNED_STORAGE_URL_PREFIX}course/thumbnail.png`,
      );
    });

    it.each(LESSON_FILE_CASES)(
      "content lesson file from $source is $fileUrl",
      async ({ fileS3Key, bunnyConfigured, fileUrl }) => {
        bunnyStreamServiceMock.isConfigured.mockResolvedValue(bunnyConfigured);
        const author = await createContentCreator();
        const { course, lesson } = await arrangeLessonInCourse(author.id, {
          type: LESSON_TYPES.CONTENT,
          fileS3Key,
          fileType: "application/pdf",
        });

        const response = await getBetaCourseAs(author, course.id);

        const betaLesson = findBetaLesson(response, lesson.id);
        match(fileUrl)
          .with(LESSON_FILE_URLS.SIGNED, () =>
            expect(betaLesson.fileS3SignedUrl).toEqual(expect.stringMatching(/^https:\/\//)),
          )
          .with(LESSON_FILE_URLS.NOT_SIGNED, () =>
            expect(betaLesson).not.toHaveProperty("fileS3SignedUrl"),
          )
          .exhaustive();
      },
    );

    it("leaves the content lesson file unsigned when signing fails", async () => {
      s3ServiceMock.getSignedUrl.mockRejectedValue(new Error("storage unavailable"));
      const author = await createContentCreator();
      const { course, lesson } = await arrangeLessonInCourse(author.id, {
        type: LESSON_TYPES.CONTENT,
        fileS3Key: "lesson/handout.pdf",
        fileType: "application/pdf",
      });

      const response = await getBetaCourseAs(author, course.id);

      expect(response.status).toBe(200);
      expect(findBetaLesson(response, lesson.id)).not.toHaveProperty("fileS3SignedUrl");
    });

    it.each(VIDEO_EMBED_CASES)(
      "$embed is $result",
      async ({ resourceReference, bunnyConfigured, embedHasError, result }) => {
        bunnyStreamServiceMock.isConfigured.mockResolvedValue(bunnyConfigured);
        const author = await createContentCreator();
        const { course, lesson } = await arrangeLessonInCourse(author.id, {
          type: LESSON_TYPES.CONTENT,
        });
        const resource = await seedInTenant(() =>
          resourceFactory
            .linkedTo({ entityId: lesson.id, entityType: ENTITY_TYPES.LESSON })
            .create({ reference: resourceReference, contentType: "video/mp4" }),
        );
        const errorAttribute = embedHasError ? ' data-error="true"' : "";
        await seedInTenant(() =>
          db
            .update(lessons)
            .set({
              description: buildJsonbField(
                SUPPORTED_LANGUAGES.EN,
                `<div data-node-type="video" data-src="/api/lesson/lesson-resource/${resource.id}"${errorAttribute}></div>`,
              ),
            })
            .where(eq(lessons.id, lesson.id)),
        );

        const response = await getBetaCourseAs(author, course.id);

        const { description } = findBetaLesson(response, lesson.id);
        match(result)
          .with(VIDEO_EMBED_RESULTS.MARKED_AS_ERROR, () =>
            expect(description).toContain('data-error="true"'),
          )
          .with(VIDEO_EMBED_RESULTS.UNCHANGED, VIDEO_EMBED_RESULTS.ERROR_CLEARED, () => {
            expect(description).toContain(`lesson-resource/${resource.id}`);
            expect(description).not.toContain("data-error");
          })
          .exhaustive();
      },
    );

    it("signs the AI mentor avatar", async () => {
      const author = await createContentCreator();
      const { course, lesson } = await arrangeLessonInCourse(author.id, {
        type: LESSON_TYPES.AI_MENTOR,
      });
      await seedInTenant(() =>
        aiMentorLessonFactory.create({
          lessonId: lesson.id,
          avatarReference: "ai-mentor/avatar.png",
        }),
      );

      const response = await getBetaCourseAs(author, course.id);

      expect(findBetaLesson(response, lesson.id)).toMatchObject({
        avatarReferenceUrl: `${SIGNED_STORAGE_URL_PREFIX}ai-mentor/avatar.png`,
      });
    });
  });

  it("forbids a private course to a learner whose enrollment was withdrawn", async () => {
    const author = await createContentCreator();
    const course = await arrangeCourse(COURSE_STATES.PRIVATE, author.id);
    const student = await createStudent();
    await seedInTenant(() =>
      studentCourseFactory.create({
        studentId: student.id,
        courseId: course.id,
        status: COURSE_ENROLLMENT.NOT_ENROLLED,
      }),
    );

    const response = await getCourseAs(student, course.id);

    expect(response.status).toBe(403);
  });
});
