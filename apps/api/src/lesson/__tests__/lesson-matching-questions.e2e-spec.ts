import { BadRequestException } from "@nestjs/common";
import {
  ASSESSMENT_FEEDBACK_MODES,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_SCORING_MODES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";

import { AiService } from "src/ai/services/ai.service";
import { FileService } from "src/file/file.service";
import { QuizAuthoringService } from "src/quiz/services/quiz-authoring.service";
import { QuizRuntimeService } from "src/quiz/services/quiz-runtime.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  assessmentQuestionMatchingPairs,
  assessmentQuestions,
  assessments,
  chapters,
  lessons,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  LESSON_TABLES,
  createCacheManagerMock,
  createFileServiceMock,
  createLessonHelpers,
  requirePresent,
  resetCacheManagerMock,
  resetFileServiceMock,
} from "../../../test/helpers/lesson";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { waitForOutbox } from "../../../test/helpers/wait-for-outbox";
import { exportCourseAsScormPackage } from "../../courses/__tests__/course-scorm-export.e2e-utils";

import type { INestApplication } from "@nestjs/common";
import type { AssessmentScoringMode, SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { CourseTest } from "test/factory/course.factory";
import type { SignedInUser } from "test/helpers/course-enrollment";

const fileServiceMock = createFileServiceMock();
const cacheManagerMock = createCacheManagerMock();

type MatchingAnswer = { answerId: UUIDType; value: string };

type DuplicationJob = { state: string; failedReason: string | null };

describe("Quiz matching questions (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createLessonHelpers>;
  let quizAuthoringService: QuizAuthoringService;
  let quizRuntimeService: QuizRuntimeService;

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
    quizAuthoringService = app.get(QuizAuthoringService);
    quizRuntimeService = app.get(QuizRuntimeService);
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

  const createAnimalsQuiz = (
    chapterId: UUIDType,
    options: Array<{ optionText: string; matchedWord: string }>,
    scoringMode?: AssessmentScoringMode,
  ) =>
    runInTenant(() =>
      quizAuthoringService.createQuizLesson({
        chapterId,
        title: "Animals",
        type: LESSON_TYPES.QUIZ,
        thresholdScore: 50,
        attemptsLimit: null,
        quizCooldownInHours: null,
        questions: [
          {
            type: ASSESSMENT_QUESTION_TYPES.MATCHING,
            title: "Match the animal with its sound",
            ...(scoringMode ? { scoringMode } : {}),
            options: options.map((option, index) => ({
              ...option,
              isCorrect: true,
              displayOrder: index + 1,
            })),
          },
        ],
      }),
    );

  const arrangeMatchingQuiz = async (
    scoringMode: AssessmentScoringMode,
    courseOverrides: Partial<CourseTest> = {},
  ) => {
    const course = await helpers.arrangeCourse(courseOverrides);
    const chapter = await helpers.arrangeChapter(course.id);
    const lesson = await createAnimalsQuiz(
      chapter.id,
      [
        { optionText: "Cat", matchedWord: "Meow" },
        { optionText: "Dog", matchedWord: "Woof" },
      ],
      scoringMode,
    );
    const quiz = await runInTenant(() =>
      quizAuthoringService.getLegacyQuizLessonForAuthoring(lesson.id),
    );
    const question = requirePresent(quiz?.questions?.[0], "matching question");
    const [cat, dog] = question.options ?? [];

    return {
      courseId: course.id,
      lesson,
      question,
      questionId: requirePresent(question.id, "question id"),
      cat: requirePresent(cat, "cat pair"),
      catId: requirePresent(cat?.id, "cat pair id"),
      dog: requirePresent(dog, "dog pair"),
      dogId: requirePresent(dog?.id, "dog pair id"),
    };
  };

  const submitMatching = (
    lessonId: UUIDType,
    questionId: UUIDType,
    learnerId: UUIDType,
    answers: MatchingAnswer[],
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ) =>
    runInTenant(() =>
      quizRuntimeService.submitQuiz(
        { lessonId, language, questionsAnswers: [{ questionId, answers }] },
        learnerId,
      ),
    );

  const deliverQuiz = (
    lessonId: UUIDType,
    learnerId: UUIDType,
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
    includeFeedback = false,
  ) =>
    runInTenant(() =>
      quizRuntimeService.getQuizForDelivery(lessonId, language, learnerId, includeFeedback),
    );

  const addCourseLanguage = (admin: SignedInUser, courseId: UUIDType) =>
    request(app.getHttpServer())
      .post(`/api/course/beta-create-language/${courseId}`)
      .query({ language: SUPPORTED_LANGUAGES.PL })
      .set("Cookie", admin.cookies)
      .expect(201);

  const findCoursePairs = (courseId: UUIDType) =>
    runInTenant(() =>
      db
        .select({
          scoringMode: assessmentQuestions.scoringMode,
          language: assessmentQuestionMatchingPairs.language,
          prompt: assessmentQuestionMatchingPairs.prompt,
          match: assessmentQuestionMatchingPairs.match,
          displayOrder: assessmentQuestionMatchingPairs.displayOrder,
        })
        .from(assessmentQuestionMatchingPairs)
        .innerJoin(
          assessmentQuestions,
          eq(assessmentQuestions.id, assessmentQuestionMatchingPairs.questionId),
        )
        .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
        .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(eq(chapters.courseId, courseId))
        .orderBy(
          assessmentQuestionMatchingPairs.language,
          assessmentQuestionMatchingPairs.displayOrder,
        ),
    );

  describe("delivery and scoring", () => {
    it("stores pairs, delivers shuffled matches and awards partial points", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { lesson, question, questionId, catId, dogId } = await arrangeMatchingQuiz(
        ASSESSMENT_SCORING_MODES.PARTIAL,
      );

      const delivery = await deliverQuiz(lesson.id, learner.id);
      const attempt = await submitMatching(lesson.id, questionId, learner.id, [
        { answerId: catId, value: "Meow" },
        { answerId: dogId, value: "Meow" },
      ]);
      const feedback = await deliverQuiz(lesson.id, learner.id, SUPPORTED_LANGUAGES.EN, true);

      expect(question).toMatchObject({
        type: ASSESSMENT_QUESTION_TYPES.MATCHING,
        scoringMode: ASSESSMENT_SCORING_MODES.PARTIAL,
        options: [
          { optionText: "Cat", matchedWord: "Meow" },
          { optionText: "Dog", matchedWord: "Woof" },
        ],
      });
      expect(new Set(delivery.questions[0].matchingTargets)).toEqual(new Set(["Meow", "Woof"]));
      expect(delivery.questions[0].options?.map(({ matchedWord }) => matchedWord)).toEqual([
        null,
        null,
      ]);
      expect(attempt).toMatchObject({ score: 50, passed: true, correctAnswerCount: 0 });
      expect(feedback.questions[0]).toMatchObject({
        passQuestion: false,
        options: [
          { optionText: "Cat", studentAnswer: "Meow", isCorrect: true, matchedWord: "Meow" },
          { optionText: "Dog", studentAnswer: "Meow", isCorrect: false, matchedWord: "Woof" },
        ],
      });
    });

    it("awards no points in all-or-nothing mode unless every pair matches", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { lesson, questionId, catId, dogId } = await arrangeMatchingQuiz(
        ASSESSMENT_SCORING_MODES.ALL_OR_NOTHING,
      );
      const submitDogMatch = (dogMatch: string) =>
        submitMatching(lesson.id, questionId, learner.id, [
          { answerId: catId, value: "Meow" },
          { answerId: dogId, value: dogMatch },
        ]);

      expect(await submitDogMatch("Meow")).toMatchObject({
        score: 0,
        passed: false,
        correctAnswerCount: 0,
      });
      expect(await submitDogMatch("Woof")).toMatchObject({
        score: 100,
        passed: true,
        correctAnswerCount: 1,
      });
    });

    it("rejects answers outside the question and duplicate pair answers", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { lesson, questionId, catId } = await arrangeMatchingQuiz(
        ASSESSMENT_SCORING_MODES.PARTIAL,
      );
      const submitAnswers = (answers: MatchingAnswer[]) =>
        submitMatching(lesson.id, questionId, learner.id, answers);

      await expect(submitAnswers([{ answerId: catId, value: "Moo" }])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        submitAnswers([
          { answerId: catId, value: "Meow" },
          { answerId: catId, value: "Woof" },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("never awards points for a matching question without pairs", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { lesson, questionId } = await arrangeMatchingQuiz(
        ASSESSMENT_SCORING_MODES.ALL_OR_NOTHING,
      );
      await runInTenant(() =>
        db
          .delete(assessmentQuestionMatchingPairs)
          .where(eq(assessmentQuestionMatchingPairs.questionId, questionId)),
      );

      expect(await submitMatching(lesson.id, questionId, learner.id, [])).toMatchObject({
        score: 0,
        passed: false,
      });
    });

    it("accepts an untranslated matching question submitted without answers", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { courseId, lesson, questionId } = await arrangeMatchingQuiz(
        ASSESSMENT_SCORING_MODES.PARTIAL,
        { baseLanguage: SUPPORTED_LANGUAGES.EN },
      );
      await addCourseLanguage(admin, courseId);

      const polish = await deliverQuiz(lesson.id, learner.id, SUPPORTED_LANGUAGES.PL);

      expect(polish.questions[0].matchingTargets?.some(Boolean)).toBe(false);
      expect(
        await submitMatching(lesson.id, questionId, learner.id, [], SUPPORTED_LANGUAGES.PL),
      ).toMatchObject({ score: 0, passed: false, correctAnswerCount: 0 });
    });
  });

  describe("authoring", () => {
    it("keeps pair identities when the author reorders pairs", async () => {
      const { lesson, question, cat, dog, catId, dogId } = await arrangeMatchingQuiz(
        ASSESSMENT_SCORING_MODES.PARTIAL,
      );

      await runInTenant(() =>
        quizAuthoringService.updateQuizLesson(lesson.id, {
          language: SUPPORTED_LANGUAGES.EN,
          questions: [{ ...question, options: [dog, cat] }],
        }),
      );
      const updated = await runInTenant(() =>
        quizAuthoringService.getLegacyQuizLessonForAuthoring(lesson.id),
      );

      expect(updated?.questions?.[0].options).toMatchObject([
        { id: dogId, optionText: "Dog" },
        { id: catId, optionText: "Cat" },
      ]);
    });

    it("translates pairs per language without changing the base pairs or the scoring mode", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { lesson, question, cat, dog } = await arrangeMatchingQuiz(
        ASSESSMENT_SCORING_MODES.PARTIAL,
        {
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
        },
      );
      await runInTenant(() =>
        db
          .update(assessments)
          .set({ availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL] })
          .where(eq(assessments.lessonId, lesson.id)),
      );
      const polishQuestion = {
        ...question,
        title: "Dopasuj zwierzę do dźwięku",
        options: [
          { ...cat, id: undefined, optionText: "Kot", matchedWord: "Miau" },
          { ...dog, id: undefined, optionText: "Pies", matchedWord: "Hau" },
        ],
      };
      const savePolish = (scoringMode?: AssessmentScoringMode) =>
        runInTenant(() =>
          quizAuthoringService.updateQuizLesson(lesson.id, {
            language: SUPPORTED_LANGUAGES.PL,
            questions: [{ ...polishQuestion, ...(scoringMode ? { scoringMode } : {}) }],
          }),
        );

      await expect(savePolish(ASSESSMENT_SCORING_MODES.ALL_OR_NOTHING)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await savePolish();
      const english = await runInTenant(() =>
        quizAuthoringService.getLegacyQuizLessonForAuthoring(lesson.id, SUPPORTED_LANGUAGES.EN),
      );
      const polish = await deliverQuiz(lesson.id, learner.id, SUPPORTED_LANGUAGES.PL);

      expect(english?.questions?.[0].options?.map(({ matchedWord }) => matchedWord)).toEqual([
        "Meow",
        "Woof",
      ]);
      expect(new Set(polish.questions[0].matchingTargets)).toEqual(new Set(["Hau", "Miau"]));
      expect(polish.questions[0].options?.map(({ optionText }) => optionText)).toEqual([
        "Kot",
        "Pies",
      ]);
    });

    it("rejects matching questions with too few pairs or repeated matches", async () => {
      const course = await helpers.arrangeCourse();
      const chapter = await helpers.arrangeChapter(course.id);

      await expect(
        createAnimalsQuiz(chapter.id, [{ optionText: "Cat", matchedWord: "Meow" }]),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        createAnimalsQuiz(chapter.id, [
          { optionText: "Cat", matchedWord: "Mammal" },
          { optionText: "Dog", matchedWord: " Mammal " },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("refuses canonical (Luma) updates of quizzes that contain matching questions", async () => {
      const { lesson } = await arrangeMatchingQuiz(ASSESSMENT_SCORING_MODES.PARTIAL);
      const definition = requirePresent(
        await runInTenant(() => quizAuthoringService.getQuizLessonForAuthoring(lesson.id)),
        "quiz definition",
      );

      await expect(
        runInTenant(() =>
          quizAuthoringService.saveCanonicalLesson(
            {
              title: "Animals",
              thresholdScore: 50,
              attemptsLimit: null,
              quizCooldownInHours: null,
              language: SUPPORTED_LANGUAGES.EN,
              questions: definition.questions,
            },
            lesson.id,
          ),
        ),
      ).rejects.toThrow("courseAuthoring.errors.matchingQuestionUnsupported");
      expect(
        (await runInTenant(() => quizAuthoringService.getQuizLessonForAuthoring(lesson.id)))
          ?.questions,
      ).toHaveLength(1);
    });
  });

  describe("course-wide operations", () => {
    it("keeps all pairs and the scoring mode when the course is duplicated", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { courseId } = await arrangeMatchingQuiz(ASSESSMENT_SCORING_MODES.PARTIAL, {
        authorId: admin.user.id,
      });

      const duplicateResponse = await request(app.getHttpServer())
        .post(`/api/course/${courseId}/duplicate`)
        .set("Cookie", admin.cookies)
        .expect(201);
      const { courseId: copyId, jobId } = duplicateResponse.body.data;
      const job = await waitForOutbox(
        app,
        async (): Promise<DuplicationJob> =>
          (
            await request(app.getHttpServer())
              .get(`/api/course/duplication-jobs/${jobId}`)
              .set("Cookie", admin.cookies)
              .expect(200)
          ).body.data,
        ({ state }) => state === "completed" || state === "failed",
      );

      expect(job).toMatchObject({ state: "completed", failedReason: null });
      expect(copyId).not.toBe(courseId);
      expect(await findCoursePairs(copyId)).toEqual(await findCoursePairs(courseId));
      expect(await findCoursePairs(copyId)).toMatchObject([
        { scoringMode: ASSESSMENT_SCORING_MODES.PARTIAL, prompt: "Cat", match: "Meow" },
        { scoringMode: ASSESSMENT_SCORING_MODES.PARTIAL, prompt: "Dog", match: "Woof" },
      ]);
    });

    it("translates both sides of every pair with automatic course translation", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { courseId } = await arrangeMatchingQuiz(ASSESSMENT_SCORING_MODES.PARTIAL, {
        authorId: admin.user.id,
        baseLanguage: SUPPORTED_LANGUAGES.EN,
      });
      await addCourseLanguage(admin, courseId);
      const generateMissingTranslations = jest
        .spyOn(app.get(AiService), "generateMissingTranslations")
        .mockImplementation(async (items) => [items.map(({ data }) => `pl ${data.base}`)]);

      try {
        await request(app.getHttpServer())
          .post(`/api/course/generate-translations/${courseId}`)
          .query({ language: SUPPORTED_LANGUAGES.PL })
          .set("Cookie", admin.cookies)
          .expect(201);
      } finally {
        generateMissingTranslations.mockRestore();
      }
      const polishPairs = (await findCoursePairs(courseId)).filter(
        ({ language }) => language === SUPPORTED_LANGUAGES.PL,
      );

      expect(polishPairs).toMatchObject([
        { prompt: "pl Cat", match: "pl Meow", displayOrder: 1 },
        { prompt: "pl Dog", match: "pl Woof", displayOrder: 2 },
      ]);
    });

    it("exports pairs, the scoring mode and the feedback mode to SCORM", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const { courseId, lesson } = await arrangeMatchingQuiz(ASSESSMENT_SCORING_MODES.PARTIAL, {
        authorId: admin.user.id,
      });
      await runInTenant(() =>
        db
          .update(assessments)
          .set({ feedbackMode: ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY })
          .where(eq(assessments.lessonId, lesson.id)),
      );

      const scormPackage = await exportCourseAsScormPackage(app, courseId, admin.cookies);
      const courseJson = requirePresent(scormPackage.getEntry("data/course.json"), "course.json");
      const exportedLesson = JSON.parse(courseJson.getData().toString("utf8")).lessons[lesson.id];

      expect(exportedLesson).toMatchObject({
        feedbackMode: ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY,
        questions: [
          {
            type: ASSESSMENT_QUESTION_TYPES.MATCHING,
            scoringMode: ASSESSMENT_SCORING_MODES.PARTIAL,
            options: [
              { title: "Cat", matchedWord: "Meow", isCorrect: true },
              { title: "Dog", matchedWord: "Woof", isCorrect: true },
            ],
          },
        ],
      });
    });
  });
});
