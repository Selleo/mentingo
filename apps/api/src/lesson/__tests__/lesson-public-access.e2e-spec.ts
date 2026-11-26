import {
  COURSE_ENROLLMENT,
  ENTITY_TYPES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq, ne } from "drizzle-orm";
import request from "supertest";

import { AiService } from "src/ai/services/ai.service";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { FileService } from "src/file/file.service";
import { OUTBOX_STATUSES } from "src/outbox/outbox.types";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { aiMentorThreads, chapters, courses, outboxEvents } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createAiMentorLessonFactory } from "../../../test/factory/ai-mentor-lesson.factory";
import {
  createResourceEntityFactory,
  createResourceFactory,
} from "../../../test/factory/resource.factory";
import {
  LESSON_TABLES,
  PUBLIC_VIDEO_CONTENT,
  createCacheManagerMock,
  createFileServiceMock,
  createLessonHelpers,
  resetCacheManagerMock,
  resetFileServiceMock,
} from "../../../test/helpers/lesson";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { dispatchOutbox } from "../../../test/helpers/wait-for-outbox";

import {
  GUEST_ACCESS_REJECTION_CASES,
  PUBLIC_LESSON_DESCRIPTION,
  PUBLIC_LESSON_TITLE,
  UNAVAILABLE_PREVIEW_CASES,
} from "./lesson-public-access.scenarios";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { LessonTypes } from "src/lesson/lesson.type";
import type { SignedInUser } from "test/helpers/course-enrollment";

const fileServiceMock = createFileServiceMock();
const cacheManagerMock = createCacheManagerMock();

describe("Lesson public access (e2e)", () => {
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

  const arrangePublicLesson = async ({
    isFreemium,
    lessonType,
  }: {
    isFreemium: boolean;
    lessonType: LessonTypes;
  }) => {
    const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const course = await helpers.arrangeCourse({
      authorId: author.id,
      priceInCents: 0,
      chapterCount: 1,
    });
    const chapter = await helpers.arrangeChapter(course.id, { authorId: author.id, isFreemium });
    const lesson = await helpers.arrangeLesson(chapter.id, {
      type: lessonType,
      thresholdScore: lessonType === LESSON_TYPES.QUIZ ? 0 : null,
      title: { [SUPPORTED_LANGUAGES.EN]: PUBLIC_LESSON_TITLE },
      description: { [SUPPORTED_LANGUAGES.EN]: PUBLIC_LESSON_DESCRIPTION },
    });

    return { courseId: course.id, lesson };
  };

  const getLesson = (lessonId: UUIDType, viewer?: SignedInUser) => {
    const lessonRequest = request(app.getHttpServer())
      .get(`/api/lesson/${lessonId}`)
      .query({ language: SUPPORTED_LANGUAGES.EN });

    return viewer ? lessonRequest.set("Cookie", viewer.cookies) : lessonRequest;
  };

  describe("GET /api/lesson/:id - public course preview", () => {
    const arrangePreview = async (
      lessonType: LessonTypes = LESSON_TYPES.CONTENT,
      previewEnabled = true,
    ) => {
      await helpers.updateGlobalSetting("publicCoursePreviewEnabled", previewEnabled);
      const { courseId, lesson } = await arrangePublicLesson({ isFreemium: false, lessonType });
      const student = await helpers.arrangeSignedInStudent();

      return { courseId, lesson, student };
    };

    it("lets a student read a free public lesson without creating progress or enrollment", async () => {
      const { lesson, student } = await arrangePreview();

      await getLesson(lesson.id, student).expect(200);

      expect(await helpers.findLearnerFootprint(student.user.id)).toEqual({
        lessonProgress: [],
        enrollments: [],
        learningModes: [],
      });
    });

    it("opens and retakes an AI Mentor preview without enrollment, learning mode or progress", async () => {
      const { lesson, student } = await arrangePreview(LESSON_TYPES.AI_MENTOR);
      await runInTenant(() =>
        createAiMentorLessonFactory(db).create({
          lessonId: lesson.id,
          name: { [SUPPORTED_LANGUAGES.EN]: "Preview mentor" },
        }),
      );
      const initializeLessonWelcome = jest
        .spyOn(app.get(AiService), "initializeLessonWelcome")
        .mockResolvedValue(undefined);

      try {
        const firstVisit = await getLesson(lesson.id, student).expect(200);

        expect(firstVisit.body.data.status).toBe(THREAD_STATUS.ACTIVE);
        expect(initializeLessonWelcome).toHaveBeenCalledWith(
          firstVisit.body.data.threadId,
          student.user.id,
        );
        expect(await findThread(firstVisit.body.data.threadId)).toMatchObject({
          userId: student.user.id,
          status: THREAD_STATUS.ACTIVE,
        });

        await request(app.getHttpServer())
          .post(`/api/ai/retake/${lesson.id}`)
          .set("Cookie", student.cookies)
          .expect(201);
        const secondVisit = await getLesson(lesson.id, student).expect(200);

        expect(secondVisit.body.data.threadId).not.toBe(firstVisit.body.data.threadId);
        expect(await findThread(firstVisit.body.data.threadId)).toMatchObject({
          status: THREAD_STATUS.ARCHIVED,
        });
        expect(await helpers.findLearnerFootprint(student.user.id)).toEqual({
          lessonProgress: [],
          enrollments: [],
          learningModes: [],
        });
      } finally {
        initializeLessonWelcome.mockRestore();
      }
    });

    it.each(UNAVAILABLE_PREVIEW_CASES)(
      "rejects the preview when $reason",
      async ({ previewEnabled, course }) => {
        const { courseId, lesson, student } = await arrangePreview(
          LESSON_TYPES.CONTENT,
          previewEnabled,
        );
        await runInTenant(() => db.update(courses).set(course).where(eq(courses.id, courseId)));

        await getLesson(lesson.id, student).expect(401);
      },
    );

    it("keeps enrolled students in the normal learning experience", async () => {
      const { courseId, lesson, student } = await arrangePreview();
      await helpers.arrangeEnrollment(student.user.id, courseId);

      await getLesson(lesson.id, student).expect(200);

      expect(await helpers.findLessonProgress(student.user.id, lesson.id)).toEqual([
        expect.objectContaining({ isStarted: true }),
      ]);
      expect(await helpers.findStudentEnrollment(student.user.id, courseId)).toMatchObject({
        status: COURSE_ENROLLMENT.ENROLLED,
      });
    });

    it("does not grant anonymous access", async () => {
      const { lesson } = await arrangePreview();

      await getLesson(lesson.id).expect(401);
    });

    it("rejects an unenrolled quiz submission even in a free preview chapter", async () => {
      const { lesson, student } = await arrangePreview(LESSON_TYPES.QUIZ);
      await runInTenant(() =>
        db.update(chapters).set({ isFreemium: true }).where(eq(chapters.id, lesson.chapterId)),
      );

      await request(app.getHttpServer())
        .post("/api/lesson/evaluation-quiz")
        .set("Cookie", student.cookies)
        .send({ lessonId: lesson.id, language: SUPPORTED_LANGUAGES.EN, questionsAnswers: [] })
        .expect(403);
    });
  });

  describe("PATCH /api/settings/admin/public-course-preview", () => {
    const togglePreview = (actor: SignedInUser, expectedStatus: number) =>
      request(app.getHttpServer())
        .patch("/api/settings/admin/public-course-preview")
        .set("Cookie", actor.cookies)
        .expect(expectedStatus);

    it("rejects students", async () => {
      const student = await helpers.arrangeSignedInStudent();

      await togglePreview(student, 403);
    });

    it("lets settings managers toggle the organization preview", async () => {
      await helpers.updateGlobalSetting("publicCoursePreviewEnabled", true);
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);

      const disabled = await togglePreview(admin, 200);
      const enabled = await togglePreview(admin, 200);

      await dispatchOutbox(app);

      expect(disabled.body.data).toMatchObject({ publicCoursePreviewEnabled: false });
      expect(enabled.body.data).toMatchObject({ publicCoursePreviewEnabled: true });
      expect(
        await dbAdmin
          .select({ eventType: outboxEvents.eventType })
          .from(outboxEvents)
          .where(ne(outboxEvents.status, OUTBOX_STATUSES.PUBLISHED)),
      ).toEqual([]);
    });
  });

  describe("GET /api/lesson/:id - guest access", () => {
    it("lets guests view a content lesson in a public chapter", async () => {
      await helpers.updateGlobalSetting("unregisteredUserCoursesAccessibility", true);
      const { lesson } = await arrangePublicLesson({
        isFreemium: true,
        lessonType: LESSON_TYPES.CONTENT,
      });

      const response = await getLesson(lesson.id).expect(200);

      expect(response.body.data).toMatchObject({
        id: lesson.id,
        type: LESSON_TYPES.CONTENT,
        title: PUBLIC_LESSON_TITLE,
        description: expect.stringContaining("Open content"),
        lessonCompleted: false,
        nextLessonId: null,
        videoCompletionTrackingEnabled: true,
      });
    });

    it.each(GUEST_ACCESS_REJECTION_CASES)(
      "rejects guests when $reason",
      async ({ visitorAccessEnabled, isFreemium, lessonType }) => {
        await helpers.updateGlobalSetting(
          "unregisteredUserCoursesAccessibility",
          visitorAccessEnabled,
        );
        const { lesson } = await arrangePublicLesson({ isFreemium, lessonType });

        const response = await getLesson(lesson.id).expect(401);

        expect(response.body).toMatchObject({ message: "common.toast.lessonAccessDenied" });
      },
    );
  });

  describe("GET /api/lesson/lesson-resource/:resourceId", () => {
    it("streams a public content lesson's resource to guests", async () => {
      await helpers.updateGlobalSetting("unregisteredUserCoursesAccessibility", true);
      const { lesson } = await arrangePublicLesson({
        isFreemium: true,
        lessonType: LESSON_TYPES.CONTENT,
      });
      const resource = await runInTenant(() =>
        createResourceFactory(db)
          .linkedTo({ entityId: lesson.id, entityType: ENTITY_TYPES.LESSON })
          .create({ reference: "public-video.mp4", contentType: "video/mp4" }),
      );

      const response = await request(app.getHttpServer())
        .get(`/api/lesson/lesson-resource/${resource.id}`)
        .expect(200);

      expect(response.body.toString()).toBe(PUBLIC_VIDEO_CONTENT);
      expect(response.headers["content-type"]).toContain("video/mp4");
    });

    it("streams a resource reused by a private and a public lesson to guests", async () => {
      await helpers.updateGlobalSetting("unregisteredUserCoursesAccessibility", true);
      const privateLesson = await arrangePublicLesson({
        isFreemium: false,
        lessonType: LESSON_TYPES.CONTENT,
      });
      const publicLesson = await arrangePublicLesson({
        isFreemium: true,
        lessonType: LESSON_TYPES.CONTENT,
      });
      const resource = await runInTenant(async () => {
        const reusedResource = await createResourceFactory(db)
          .linkedTo({ entityId: privateLesson.lesson.id, entityType: ENTITY_TYPES.LESSON })
          .create({ reference: "reused-public-video.mp4", contentType: "video/mp4" });
        await createResourceEntityFactory(db).create({
          resourceId: reusedResource.id,
          entityId: publicLesson.lesson.id,
          entityType: ENTITY_TYPES.LESSON,
        });

        return reusedResource;
      });

      const response = await request(app.getHttpServer())
        .get(`/api/lesson/lesson-resource/${resource.id}`)
        .expect(200);

      expect(response.body.toString()).toBe(PUBLIC_VIDEO_CONTENT);
      expect(response.headers["content-type"]).toContain("video/mp4");
    });
  });

  const findThread = (threadId: UUIDType) =>
    runInTenant(async () => {
      const [thread] = await db
        .select()
        .from(aiMentorThreads)
        .where(eq(aiMentorThreads.id, threadId));

      return thread;
    });
});
