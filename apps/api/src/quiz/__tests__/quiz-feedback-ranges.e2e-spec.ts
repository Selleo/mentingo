import {
  ASSESSMENT_FEEDBACK_MODES,
  ASSESSMENT_QUESTION_TYPES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
} from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { AiService } from "src/ai/services/ai.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QuizAuthoringService } from "src/quiz/services/quiz-authoring.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { chapters, lessons } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";
import { waitForOutbox } from "../../../test/helpers/wait-for-outbox";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const FEEDBACK_RANGES = [
  { minPercent: 0, maxPercent: 49, message: "<p>Keep practising {{firstName}}.</p>" },
  { minPercent: 50, maxPercent: 79, message: "<p>Almost there, {{score}}%.</p>" },
  { minPercent: 80, maxPercent: 100, message: "<p>Well done {{firstName}}!</p>" },
];

// Stored ranges also carry their row id.
const rangesMatching = (ranges: Array<Record<string, unknown>>) =>
  ranges.map((range) => expect.objectContaining(range));

describe("Quiz feedback ranges round-trips (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest([
      {
        provide: "CACHE_MANAGER",
        useValue: { get: jest.fn().mockResolvedValue(""), set: jest.fn().mockResolvedValue("") },
      },
    ]);

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await createSettingsFactory(db).create({ userId: null });
  });

  afterEach(async () => {
    await truncateTables(baseDb, [
      "assessment_feedback_ranges",
      "assessment_questions",
      "assessments",
      "lessons",
      "chapters",
      "courses",
      "users",
      "categories",
      "settings",
    ]);
  });

  const createAdmin = () =>
    userFactory
      .withCredentials({ password: "password123" })
      .withAdminSettings(db)
      .withAdminRole()
      .create();

  const createFeedbackQuiz = async (
    courseOverrides: Parameters<typeof courseFactory.create>[0],
  ) => {
    const course = await courseFactory.create({ thumbnailS3Key: null, ...courseOverrides });
    const chapter = await chapterFactory.create({ courseId: course.id });

    await app.get(QuizAuthoringService).createQuizLesson({
      chapterId: chapter.id,
      title: "Feedback quiz",
      type: LESSON_TYPES.QUIZ,
      thresholdScore: 50,
      attemptsLimit: null,
      quizCooldownInHours: null,
      feedbackMode: ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY,
      feedbackRanges: FEEDBACK_RANGES,
      questions: [
        {
          type: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
          title: "Pick the right one",
          options: [
            { optionText: "Right", isCorrect: true, displayOrder: 1 },
            { optionText: "Wrong", isCorrect: false, displayOrder: 2 },
          ],
        },
      ],
    });

    return course.id;
  };

  const getCourseQuizFeedback = async (
    courseId: UUIDType,
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ) => {
    const [quizLesson] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(and(eq(chapters.courseId, courseId), eq(lessons.type, LESSON_TYPES.QUIZ)));

    if (!quizLesson) throw new Error(`Course ${courseId} has no quiz lesson`);

    const quiz = await app
      .get(QuizAuthoringService)
      .getLegacyQuizLessonForAuthoring(quizLesson.id, language);

    return {
      lessonId: quizLesson.id,
      feedbackMode: quiz?.feedbackMode,
      feedbackRanges: quiz?.feedbackRanges,
    };
  };

  it("keeps the feedback mode and every range when the course is duplicated", async () => {
    const admin = await createAdmin();
    const cookie = await cookieFor(admin, app);
    const courseId = await createFeedbackQuiz({ authorId: admin.id });

    const duplicateResponse = await request(app.getHttpServer())
      .post(`/api/course/${courseId}/duplicate`)
      .set("Cookie", cookie)
      .expect(201);
    const { courseId: copyId, jobId } = duplicateResponse.body.data;

    const job = await waitForOutbox(
      app,
      async () =>
        (
          await request(app.getHttpServer())
            .get(`/api/course/duplication-jobs/${jobId}`)
            .set("Cookie", cookie)
            .expect(200)
        ).body.data as { state: string; failedReason: string | null },
      ({ state }) => state === "completed" || state === "failed",
    );

    expect(job).toMatchObject({ state: "completed", failedReason: null });

    const source = await getCourseQuizFeedback(courseId);
    const copy = await getCourseQuizFeedback(copyId);

    expect(copy.lessonId).not.toBe(source.lessonId);
    expect(copy.feedbackMode).toBe(ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY);
    expect(copy.feedbackRanges).toEqual(rangesMatching(FEEDBACK_RANGES));
  });

  it("translates every range message with automatic course translation and keeps the bounds", async () => {
    const admin = await createAdmin();
    const cookie = await cookieFor(admin, app);
    const courseId = await createFeedbackQuiz({
      authorId: admin.id,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
    });

    await request(app.getHttpServer())
      .post(`/api/course/beta-create-language/${courseId}`)
      .query({ language: SUPPORTED_LANGUAGES.PL })
      .set("Cookie", cookie)
      .expect(201);

    const generateTranslations = jest
      .spyOn(app.get(AiService), "generateMissingTranslations")
      .mockImplementation(async (items) => [items.map(({ data }) => `pl ${data.base}`)]);

    try {
      await request(app.getHttpServer())
        .post(`/api/course/generate-translations/${courseId}`)
        .query({ language: SUPPORTED_LANGUAGES.PL })
        .set("Cookie", cookie)
        .expect(201);
    } finally {
      generateTranslations.mockRestore();
    }

    const english = await getCourseQuizFeedback(courseId, SUPPORTED_LANGUAGES.EN);
    const polish = await getCourseQuizFeedback(courseId, SUPPORTED_LANGUAGES.PL);

    expect(english.feedbackRanges).toEqual(rangesMatching(FEEDBACK_RANGES));
    expect(polish.feedbackMode).toBe(ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY);
    expect(polish.feedbackRanges).toEqual(
      rangesMatching(
        FEEDBACK_RANGES.map((range) => ({ ...range, message: `pl ${range.message}` })),
      ),
    );
  });
});
