import { faker } from "@faker-js/faker";
import {
  ASSESSMENT_QUESTION_TYPES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { asc, eq, ne } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { FileService } from "src/file/file.service";
import { OUTBOX_STATUSES } from "src/outbox/outbox.types";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  assessmentQuestions,
  assessments,
  chapters,
  lessons,
  outboxEvents,
  resourceEntity,
  resources,
} from "src/storage/schema";

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
import { dispatchOutbox } from "../../../test/helpers/wait-for-outbox";

import {
  ADDED_EMBED_URL,
  CONTENT_LESSON_BODY,
  EMBED_URL,
  INSECURE_EMBED_URL,
  LESSON_CREATION_REJECTIONS,
  LESSON_CREATION_REJECTION_CASES,
  QUIZ_LESSON_BODY,
  TOO_LONG_LESSON_TITLE,
  UPDATED_EMBED_URL,
} from "./lesson-authoring.scenarios";

import type { LessonCreationRejection } from "./lesson-authoring.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const fileServiceMock = createFileServiceMock();
const cacheManagerMock = createCacheManagerMock();

describe("Lesson authoring (e2e)", () => {
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

  const arrangeAuthorChapter = async (lessonCount = 0) => {
    const author = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    const course = await helpers.arrangeCourse({ authorId: author.user.id });
    const chapter = await helpers.arrangeChapter(course.id, {
      authorId: author.user.id,
      lessonCount,
    });

    return { author, courseId: course.id, chapterId: chapter.id };
  };

  const arrangeChapterLessons = async (chapterId: UUIDType, count: number) => {
    const chapterLessons = [];

    for (let displayOrder = 1; displayOrder <= count; displayOrder++) {
      chapterLessons.push(await helpers.arrangeLesson(chapterId, { displayOrder }));
    }

    return chapterLessons;
  };

  const findChapterLessons = (chapterId: UUIDType) =>
    runInTenant(() =>
      db
        .select({
          id: lessons.id,
          type: lessons.type,
          title: lessons.title,
          description: lessons.description,
          displayOrder: lessons.displayOrder,
        })
        .from(lessons)
        .where(eq(lessons.chapterId, chapterId))
        .orderBy(asc(lessons.displayOrder)),
    );

  const findChapterLessonCount = (chapterId: UUIDType) =>
    runInTenant(async () => {
      const [chapter] = await db
        .select({ lessonCount: chapters.lessonCount })
        .from(chapters)
        .where(eq(chapters.id, chapterId));

      return chapter.lessonCount;
    });

  const findLessonResources = (lessonId: UUIDType) =>
    runInTenant(() =>
      db
        .select({
          reference: resources.reference,
          metadata: resources.metadata,
          archived: resources.archived,
        })
        .from(resources)
        .innerJoin(resourceEntity, eq(resourceEntity.resourceId, resources.id))
        .where(eq(resourceEntity.entityId, lessonId))
        .orderBy(asc(resources.reference)),
    );

  const sendAs = (author: SignedInUser, pendingRequest: request.Test) =>
    pendingRequest.set("Cookie", author.cookies);

  describe("POST /api/lesson/beta-create-lesson", () => {
    it("appends a content lesson to the chapter and counts it", async () => {
      const { author, chapterId } = await arrangeAuthorChapter(1);
      const [existingLesson] = await arrangeChapterLessons(chapterId, 1);

      const response = await sendAs(
        author,
        request(app.getHttpServer()).post("/api/lesson/beta-create-lesson"),
      )
        .send({ ...CONTENT_LESSON_BODY, chapterId })
        .expect(201);

      expect(await findChapterLessons(chapterId)).toEqual([
        expect.objectContaining({ id: existingLesson.id, displayOrder: 1 }),
        {
          id: response.body.data.id,
          type: LESSON_TYPES.CONTENT,
          title: { en: CONTENT_LESSON_BODY.title },
          description: { en: expect.stringContaining("Welcome to the course.") },
          displayOrder: 2,
        },
      ]);
      expect(await findChapterLessonCount(chapterId)).toBe(2);
    });

    const arrangeRejectedCreation = (rejection: LessonCreationRejection) =>
      match(rejection)
        .with(LESSON_CREATION_REJECTIONS.OTHER_AUTHOR, async () => {
          const { chapterId } = await arrangeAuthorChapter();
          const otherAuthor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);

          return { author: otherAuthor, body: { ...CONTENT_LESSON_BODY, chapterId } };
        })
        .with(LESSON_CREATION_REJECTIONS.TITLE_TOO_LONG, async () => {
          const { author, chapterId } = await arrangeAuthorChapter();

          return {
            author,
            body: { ...CONTENT_LESSON_BODY, chapterId, title: TOO_LONG_LESSON_TITLE },
          };
        })
        .with(LESSON_CREATION_REJECTIONS.MISSING_CHAPTER, async () => {
          const { author } = await arrangeAuthorChapter();

          return { author, body: { ...CONTENT_LESSON_BODY, chapterId: faker.string.uuid() } };
        })
        .exhaustive();

    it.each(LESSON_CREATION_REJECTION_CASES)(
      "rejects with $expectedStatus when $rejection",
      async ({ rejection, expectedStatus, expectedMessage }) => {
        const { author, body } = await arrangeRejectedCreation(rejection);

        const response = await sendAs(
          author,
          request(app.getHttpServer()).post("/api/lesson/beta-create-lesson"),
        )
          .send(body)
          .expect(expectedStatus);

        expect(response.body).toMatchObject({ message: expectedMessage });
      },
    );
  });

  describe("lesson events", () => {
    const findUndeliveredEventTypes = async () =>
      (
        await dbAdmin
          .select({ eventType: outboxEvents.eventType })
          .from(outboxEvents)
          .where(ne(outboxEvents.status, OUTBOX_STATUSES.PUBLISHED))
      ).map(({ eventType }) => eventType);

    const findLessonDurationEstimates = (lessonId: UUIDType) =>
      runInTenant(async () => {
        const [lesson] = await db
          .select({ durationEstimates: lessons.durationEstimates })
          .from(lessons)
          .where(eq(lessons.id, lessonId));

        return lesson?.durationEstimates;
      });

    it("delivers lesson events and estimates the new lesson's duration", async () => {
      const { author, chapterId } = await arrangeAuthorChapter();
      const created = await sendAs(
        author,
        request(app.getHttpServer()).post("/api/lesson/beta-create-lesson"),
      )
        .send({ ...CONTENT_LESSON_BODY, chapterId })
        .expect(201);
      const lessonId: UUIDType = created.body.data.id;
      await sendAs(
        author,
        request(app.getHttpServer())
          .patch("/api/lesson/beta-update-lesson")
          .query({ id: lessonId }),
      )
        .send({ title: "Renamed lesson", language: SUPPORTED_LANGUAGES.EN })
        .expect(200);

      await dispatchOutbox(app);

      expect(await findUndeliveredEventTypes()).toEqual([]);
      expect(await findLessonDurationEstimates(lessonId)).not.toEqual({});
    });

    it("delivers the deletion event of a removed lesson", async () => {
      const { author, chapterId } = await arrangeAuthorChapter(1);
      const [lesson] = await arrangeChapterLessons(chapterId, 1);

      await sendAs(author, request(app.getHttpServer()).delete("/api/lesson"))
        .query({ lessonId: lesson.id })
        .expect(200);
      await dispatchOutbox(app);

      expect(await findUndeliveredEventTypes()).toEqual([]);
      expect(await findChapterLessons(chapterId)).toEqual([]);
    });
  });

  describe("PATCH /api/lesson/beta-update-lesson", () => {
    const updateLesson = (author: SignedInUser, lessonId: UUIDType, body: object) =>
      sendAs(
        author,
        request(app.getHttpServer())
          .patch("/api/lesson/beta-update-lesson")
          .query({ id: lessonId }),
      ).send(body);

    it("updates the title and description in the base language", async () => {
      const { author, chapterId } = await arrangeAuthorChapter(1);
      const [lesson] = await arrangeChapterLessons(chapterId, 1);

      await updateLesson(author, lesson.id, {
        title: "Renamed lesson",
        description: "Updated content",
        language: SUPPORTED_LANGUAGES.EN,
      }).expect(200);

      expect(await findChapterLessons(chapterId)).toEqual([
        expect.objectContaining({
          title: { en: "Renamed lesson" },
          description: { en: expect.stringContaining("Updated content") },
        }),
      ]);
    });

    it("rejects a language the course does not offer", async () => {
      const { author, chapterId } = await arrangeAuthorChapter(1);
      const [lesson] = await arrangeChapterLessons(chapterId, 1);

      const response = await updateLesson(author, lesson.id, {
        title: "Lekcja",
        language: SUPPORTED_LANGUAGES.PL,
      }).expect(400);

      expect(response.body).toMatchObject({
        message: "adminCourseView.toast.languageNotSupported",
      });
    });
  });

  describe("PATCH /api/lesson/update-lesson-display-order", () => {
    it("moves the lesson and shifts the lessons in between", async () => {
      const { author, chapterId } = await arrangeAuthorChapter(3);
      const [first, second, third] = await arrangeChapterLessons(chapterId, 3);

      await sendAs(
        author,
        request(app.getHttpServer()).patch("/api/lesson/update-lesson-display-order"),
      )
        .send({ lessonId: third.id, displayOrder: 1 })
        .expect(200);

      expect(
        (await findChapterLessons(chapterId)).map(({ id, displayOrder }) => ({ id, displayOrder })),
      ).toEqual([
        { id: third.id, displayOrder: 1 },
        { id: first.id, displayOrder: 2 },
        { id: second.id, displayOrder: 3 },
      ]);
    });
  });

  describe("quiz lessons", () => {
    const singleChoiceQuestion = (title: string) => ({
      type: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
      title,
      options: [
        { optionText: "Yes", isCorrect: true, displayOrder: 1 },
        { optionText: "No", isCorrect: false, displayOrder: 2 },
      ],
    });

    const createQuizLesson = (author: SignedInUser, body: object) =>
      sendAs(author, request(app.getHttpServer()).post("/api/lesson/beta-create-lesson/quiz")).send(
        body,
      );

    const findQuizQuestionTitles = (lessonId: UUIDType) =>
      runInTenant(async () =>
        (
          await db
            .select({ title: assessmentQuestions.title })
            .from(assessmentQuestions)
            .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
            .where(eq(assessments.lessonId, lessonId))
            .orderBy(asc(assessmentQuestions.displayOrder))
        ).map(({ title }) => title),
      );

    it("creates a quiz lesson with its questions", async () => {
      const { author, chapterId } = await arrangeAuthorChapter();

      const response = await createQuizLesson(author, {
        ...QUIZ_LESSON_BODY,
        chapterId,
        questions: [singleChoiceQuestion("Ready?")],
      }).expect(201);

      expect(await findQuizQuestionTitles(response.body.data.id)).toEqual([{ en: "Ready?" }]);
      expect(await findChapterLessonCount(chapterId)).toBe(1);
    });

    it("rejects a quiz lesson without questions", async () => {
      const { author, chapterId } = await arrangeAuthorChapter();

      const response = await createQuizLesson(author, {
        ...QUIZ_LESSON_BODY,
        chapterId,
        questions: [],
      }).expect(400);

      expect(response.body).toMatchObject({
        message: "adminCourseView.errors.lesson.questionsRequired",
      });
    });

    it("replaces the questions of an existing quiz lesson", async () => {
      const { author, chapterId } = await arrangeAuthorChapter();
      const created = await createQuizLesson(author, {
        ...QUIZ_LESSON_BODY,
        chapterId,
        questions: [singleChoiceQuestion("Ready?")],
      }).expect(201);

      await sendAs(
        author,
        request(app.getHttpServer())
          .patch("/api/lesson/beta-update-lesson/quiz")
          .query({ id: created.body.data.id }),
      )
        .send({
          ...QUIZ_LESSON_BODY,
          title: "Updated quiz",
          language: SUPPORTED_LANGUAGES.EN,
          questions: [singleChoiceQuestion("Still ready?")],
        })
        .expect(200);

      expect(await findQuizQuestionTitles(created.body.data.id)).toEqual([{ en: "Still ready?" }]);
      expect(await findChapterLessons(chapterId)).toEqual([
        expect.objectContaining({ title: { en: "Updated quiz" } }),
      ]);
    });
  });

  describe("embed lessons", () => {
    const createEmbedLesson = (author: SignedInUser, chapterId: UUIDType, fileUrl: string) =>
      sendAs(author, request(app.getHttpServer()).post("/api/lesson/create-lesson/embed")).send({
        title: "Embedded tool",
        type: LESSON_TYPES.EMBED,
        chapterId,
        resources: [{ fileUrl, allowFullscreen: true }],
      });

    it("creates an embed lesson with its embedded resources", async () => {
      const { author, chapterId } = await arrangeAuthorChapter();

      await createEmbedLesson(author, chapterId, EMBED_URL).expect(201);
      const [lesson] = await findChapterLessons(chapterId);

      expect(lesson).toMatchObject({ type: LESSON_TYPES.EMBED, title: { en: "Embedded tool" } });
      expect(await findLessonResources(lesson.id)).toEqual([
        { reference: EMBED_URL, metadata: { allowFullscreen: true }, archived: false },
      ]);
    });

    it("rejects embedded resources that are not served over https", async () => {
      const { author, chapterId } = await arrangeAuthorChapter();

      const response = await createEmbedLesson(author, chapterId, INSECURE_EMBED_URL).expect(400);

      expect(response.body).toMatchObject({
        message: "adminCourseView.curriculum.lesson.validation.sourceUrlInvalid",
      });
    });

    it("updates kept resources, adds new ones and removes the rest", async () => {
      const { author, chapterId } = await arrangeAuthorChapter();
      await createEmbedLesson(author, chapterId, EMBED_URL).expect(201);
      const [lesson] = await findChapterLessons(chapterId);
      const [keptResourceEntity] = await runInTenant(() =>
        db
          .select({ resourceId: resourceEntity.resourceId })
          .from(resourceEntity)
          .where(eq(resourceEntity.entityId, lesson.id)),
      );

      await sendAs(
        author,
        request(app.getHttpServer()).patch(`/api/lesson/update-lesson/embed/${lesson.id}`),
      )
        .send({
          title: "Embedded tool v2",
          type: LESSON_TYPES.EMBED,
          lessonId: lesson.id,
          language: SUPPORTED_LANGUAGES.EN,
          resources: [
            { id: keptResourceEntity.resourceId, fileUrl: UPDATED_EMBED_URL },
            { fileUrl: ADDED_EMBED_URL, allowFullscreen: true },
          ],
        })
        .expect(200);

      expect(await findLessonResources(lesson.id)).toEqual([
        { reference: ADDED_EMBED_URL, metadata: { allowFullscreen: true }, archived: false },
        { reference: UPDATED_EMBED_URL, metadata: { allowFullscreen: false }, archived: false },
      ]);
    });

    it("archives every resource when the update sends none", async () => {
      const { author, chapterId } = await arrangeAuthorChapter();
      await createEmbedLesson(author, chapterId, EMBED_URL).expect(201);
      const [lesson] = await findChapterLessons(chapterId);

      await sendAs(
        author,
        request(app.getHttpServer()).patch(`/api/lesson/update-lesson/embed/${lesson.id}`),
      )
        .send({
          title: "Embedded tool",
          type: LESSON_TYPES.EMBED,
          lessonId: lesson.id,
          language: SUPPORTED_LANGUAGES.EN,
          resources: [],
        })
        .expect(200);

      expect(await findLessonResources(lesson.id)).toEqual([
        { reference: EMBED_URL, metadata: { allowFullscreen: true }, archived: true },
      ]);
    });
  });

  describe("GET /api/lesson/all", () => {
    it("lists the lessons of the enrolled courses matching the filters", async () => {
      const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const student = await helpers.arrangeSignedInStudent();
      const course = await helpers.arrangeCourse({ authorId: author.id });
      const otherCourse = await helpers.arrangeCourse({ authorId: author.id });
      const chapter = await helpers.arrangeChapter(course.id);
      const otherChapter = await helpers.arrangeChapter(otherCourse.id);
      const matchingLesson = await helpers.arrangeLesson(chapter.id, {
        title: { en: "Negotiation basics" },
        description: { en: "<p>Opening offers</p>" },
      });
      await helpers.arrangeLesson(chapter.id, { title: { en: "Closing" }, displayOrder: 2 });
      await helpers.arrangeLesson(otherChapter.id, { title: { en: "Negotiation advanced" } });
      await helpers.arrangeEnrollment(student.user.id, course.id);

      const response = await sendAs(student, request(app.getHttpServer()).get("/api/lesson/all"))
        .query({
          title: "Negotiation",
          description: "offers",
          lessonCompleted: "false",
          language: SUPPORTED_LANGUAGES.EN,
        })
        .expect(200);

      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: matchingLesson.id,
          title: "Negotiation basics",
          courseId: course.id,
          lessonCompleted: false,
        }),
      ]);
    });

    it("lists only the content creator's own course lessons", async () => {
      const author = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const otherAuthor = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const ownCourse = await helpers.arrangeCourse({ authorId: author.user.id });
      const otherCourse = await helpers.arrangeCourse({ authorId: otherAuthor.id });
      const ownLesson = await helpers.arrangeLesson(
        (await helpers.arrangeChapter(ownCourse.id)).id,
      );
      await helpers.arrangeLesson((await helpers.arrangeChapter(otherCourse.id)).id);

      const response = await sendAs(author, request(app.getHttpServer()).get("/api/lesson/all"))
        .query({
          title: "",
          description: "",
          lessonCompleted: "",
          language: SUPPORTED_LANGUAGES.EN,
        })
        .expect(200);

      expect(response.body.data).toEqual([expect.objectContaining({ id: ownLesson.id })]);
    });
  });
});
