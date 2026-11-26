import { COURSE_STATUSES, SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  LESSON_TABLES,
  createCacheManagerMock,
  createFileServiceMock,
  createLessonHelpers,
  resetCacheManagerMock,
  resetFileServiceMock,
} from "../../../test/helpers/lesson";
import { truncateTables } from "../../../test/helpers/test-helpers";

import { LESSON_COMPLETION_CASES, LESSON_LEARNERS } from "./lesson-progress.scenarios";

import type { LessonLearner } from "./lesson-progress.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { CourseStatus } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const PLAIN_TEXT_DESCRIPTION = "Test content";

const fileServiceMock = createFileServiceMock();
const cacheManagerMock = createCacheManagerMock();

describe("Lesson progress (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createLessonHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: FileService, useValue: fileServiceMock },
        { provide: "CACHE_MANAGER", useValue: cacheManagerMock },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createLessonHelpers({ app, db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, LESSON_TABLES);
    resetFileServiceMock(fileServiceMock);
    resetCacheManagerMock(cacheManagerMock);
    await helpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, LESSON_TABLES);
  });

  const arrangeContentLesson = async (authorId: UUIDType, status: CourseStatus) => {
    const course = await helpers.arrangeCourse({ authorId, status, chapterCount: 1 });
    const chapter = await helpers.arrangeChapter(course.id, { authorId });
    const lesson = await helpers.arrangeLesson(chapter.id, {
      description: { en: PLAIN_TEXT_DESCRIPTION },
    });

    return { courseId: course.id, lessonId: lesson.id };
  };

  const completeLesson = (actor: SignedInUser, lessonId: UUIDType, expectedStatus = 201) =>
    request(app.getHttpServer())
      .post("/api/studentLessonProgress")
      .query({ id: lessonId, language: SUPPORTED_LANGUAGES.EN })
      .set("Cookie", actor.cookies)
      .expect(expectedStatus);

  describe("POST /api/studentLessonProgress", () => {
    const arrangeLearner = async (learner: LessonLearner) => {
      const arrangeOthersLesson = async () => {
        const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);

        return arrangeContentLesson(author.id, COURSE_STATUSES.PUBLISHED);
      };

      return match(learner)
        .with(LESSON_LEARNERS.ENROLLED_CONTENT_CREATOR, async () => {
          const actor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
          const { courseId, lessonId } = await arrangeOthersLesson();
          await helpers.arrangeEnrollment(actor.user.id, courseId);

          return { actor, lessonId };
        })
        .with(LESSON_LEARNERS.ENROLLED_AUTHOR, async () => {
          const actor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
          const { courseId, lessonId } = await arrangeContentLesson(
            actor.user.id,
            COURSE_STATUSES.PUBLISHED,
          );
          await helpers.arrangeEnrollment(actor.user.id, courseId);

          return { actor, lessonId };
        })
        .with(LESSON_LEARNERS.ADMIN, async () => {
          const actor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
          const { lessonId } = await arrangeOthersLesson();

          return { actor, lessonId };
        })
        .with(LESSON_LEARNERS.ADMIN_IN_LEARNING_MODE, async () => {
          const actor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
          const { courseId, lessonId } = await arrangeOthersLesson();
          await helpers.arrangeLearningMode(actor.user.id, courseId);

          return { actor, lessonId };
        })
        .exhaustive();
    };

    it.each(LESSON_COMPLETION_CASES)(
      "completes the lesson ($expectedCompleted) for $learner",
      async ({ learner, expectedCompleted }) => {
        const { actor, lessonId } = await arrangeLearner(learner);

        await completeLesson(actor, lessonId);

        const expectedProgress = match(expectedCompleted)
          .with(true, () => [expect.objectContaining({ completedAt: expect.any(String) })])
          .with(false, () => [])
          .exhaustive();

        expect(await helpers.findLessonProgress(actor.user.id, lessonId)).toEqual(expectedProgress);
      },
    );

    it("rejects progress in a draft course", async () => {
      const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { courseId, lessonId } = await arrangeContentLesson(author.id, COURSE_STATUSES.DRAFT);
      await helpers.arrangeLearningMode(admin.user.id, courseId);

      const response = await completeLesson(admin, lessonId, 403);

      expect(response.body).toMatchObject({ message: "modernCourseView.draftCourseTooltip" });
      expect(await helpers.findLessonProgress(admin.user.id, lessonId)).toEqual([]);
    });
  });

  describe("GET /api/lesson/:id", () => {
    it("lets an admin preview a draft lesson outside learning mode", async () => {
      const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { lessonId } = await arrangeContentLesson(author.id, COURSE_STATUSES.DRAFT);

      expect(await helpers.fetchLesson(admin, lessonId)).toMatchObject({ id: lessonId });
    });
  });
});
