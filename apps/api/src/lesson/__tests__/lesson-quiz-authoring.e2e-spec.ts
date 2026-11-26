import { randomUUID } from "crypto";

import { BadRequestException } from "@nestjs/common";
import {
  ASSESSMENT_GRADING_MODES,
  ASSESSMENT_QUESTION_TYPES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import { match } from "ts-pattern";

import { FileService } from "src/file/file.service";
import { QuizAuthoringService } from "src/quiz/services/quiz-authoring.service";
import { QuizRuntimeService } from "src/quiz/services/quiz-runtime.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  assessmentAttemptBlankAnswers,
  assessmentAttemptQuestionAnswers,
  assessmentQuestions,
  assessments,
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

import {
  BASE_FEEDBACK_RANGES,
  DRAG_AND_DROP_PLACEMENT_CASES,
  QUESTION_SHAPES,
  QUESTION_TYPE_CASES,
} from "./lesson-quiz-authoring.scenarios";

import type { QuestionShape } from "./lesson-quiz-authoring.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { AssessmentQuestionType, SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { AdminOptionBody, AdminQuestionBody } from "src/lesson/lesson.schema";

const fileServiceMock = createFileServiceMock();
const cacheManagerMock = createCacheManagerMock();

type QuizQuestionsInput = Parameters<QuizAuthoringService["createQuizLesson"]>[0]["questions"];
type QuizFeedbackRangesInput = Parameters<
  QuizAuthoringService["createQuizLesson"]
>[0]["feedbackRanges"];

describe("Quiz lesson authoring (e2e)", () => {
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

  const arrangeAuthoredQuiz = async ({
    title,
    questions,
    feedbackRanges,
    baseLanguage = SUPPORTED_LANGUAGES.EN,
    availableLocales = [SUPPORTED_LANGUAGES.EN],
  }: {
    title: string;
    questions: QuizQuestionsInput;
    feedbackRanges?: QuizFeedbackRangesInput;
    baseLanguage?: SupportedLanguages;
    availableLocales?: SupportedLanguages[];
  }) => {
    const course = await helpers.arrangeCourse({ baseLanguage, availableLocales });
    const chapter = await helpers.arrangeChapter(course.id);

    return runInTenant(async () => {
      const lesson = await quizAuthoringService.createQuizLesson({
        chapterId: chapter.id,
        title,
        type: LESSON_TYPES.QUIZ,
        thresholdScore: 50,
        attemptsLimit: null,
        quizCooldownInHours: null,
        questions,
        ...(feedbackRanges ? { feedbackRanges } : {}),
      });

      if (availableLocales.length > 1) {
        await db
          .update(assessments)
          .set({ availableLocales })
          .where(eq(assessments.lessonId, lesson.id));
      }

      return lesson;
    });
  };

  const readLegacyQuiz = (lessonId: UUIDType, language?: SupportedLanguages) =>
    runInTenant(() => quizAuthoringService.getLegacyQuizLessonForAuthoring(lessonId, language));

  const readQuizDefinition = (lessonId: UUIDType, language?: SupportedLanguages) =>
    runInTenant(() => quizAuthoringService.getQuizLessonForAuthoring(lessonId, language));

  const saveQuiz = (
    lessonId: UUIDType,
    input: Parameters<QuizAuthoringService["updateQuizLesson"]>[1],
  ) => runInTenant(() => quizAuthoringService.updateQuizLesson(lessonId, input));

  const readFirstLegacyQuestion = async (lessonId: UUIDType, language?: SupportedLanguages) => {
    const quiz = await readLegacyQuiz(lessonId, language);

    return requirePresent(quiz?.questions?.[0], "authored question");
  };

  describe("QuizRuntimeService.submitQuiz - drag-and-drop blanks", () => {
    it.each(DRAG_AND_DROP_PLACEMENT_CASES)(
      "scores placements $firstPlacement, $secondPlacement with $expectedScore and stores them",
      async ({ firstPlacement, secondPlacement, expectedScore }) => {
        const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
        const firstBlankId = randomUUID();
        const secondBlankId = randomUUID();
        const lesson = await arrangeAuthoredQuiz({
          title: "Drag-and-drop placement regression",
          baseLanguage: SUPPORTED_LANGUAGES.PL,
          questions: [
            {
              type: ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND,
              title: "Complete the procedure",
              description: `First <blank-answer-${firstBlankId}> then <blank-answer-${secondBlankId}>.`,
              options: [
                { id: firstBlankId, optionText: "Stop", isCorrect: true, displayOrder: 1 },
                { id: secondBlankId, optionText: "Report", isCorrect: true, displayOrder: 2 },
                { optionText: "Continue", isCorrect: false, displayOrder: 3 },
              ],
            },
          ],
        });
        const definition = await readQuizDefinition(lesson.id, SUPPORTED_LANGUAGES.PL);
        const question = requirePresent(definition?.questions[0], "drag-and-drop question");
        const dragOptionIdFor = (label: string) =>
          requirePresent(
            question.dragAndDropOptions.find((option) => option.label === label),
            `drag option ${label}`,
          ).id;

        const result = await runInTenant(() =>
          quizRuntimeService.submitQuiz(
            {
              lessonId: lesson.id,
              language: SUPPORTED_LANGUAGES.PL,
              questionsAnswers: [
                {
                  questionId: question.id,
                  answers: [
                    { answerId: firstBlankId, value: firstPlacement },
                    { answerId: secondBlankId, value: secondPlacement },
                  ],
                },
              ],
            },
            learner.id,
          ),
        );
        const storedPlacements = await runInTenant(() =>
          db
            .select({
              blankId: assessmentAttemptBlankAnswers.blankId,
              selectedOptionId: assessmentAttemptBlankAnswers.selectedDragOptionId,
            })
            .from(assessmentAttemptBlankAnswers)
            .innerJoin(
              assessmentAttemptQuestionAnswers,
              eq(
                assessmentAttemptQuestionAnswers.id,
                assessmentAttemptBlankAnswers.questionAnswerId,
              ),
            )
            .where(eq(assessmentAttemptQuestionAnswers.attemptId, result.attemptId)),
        );

        expect(result).toMatchObject({ attemptNumber: 1, score: expectedScore });
        expect(storedPlacements).toHaveLength(2);
        expect(storedPlacements).toEqual(
          expect.arrayContaining([
            { blankId: firstBlankId, selectedOptionId: dragOptionIdFor(firstPlacement) },
            { blankId: secondBlankId, selectedOptionId: dragOptionIdFor(secondPlacement) },
          ]),
        );
      },
    );
  });

  describe("QuizAuthoringService.updateQuizLesson", () => {
    const optionsFor = (shape: QuestionShape, optionId: UUIDType): AdminOptionBody[] =>
      match(shape)
        .with(QUESTION_SHAPES.OPEN_TEXT, () => [])
        .with(QUESTION_SHAPES.CHOICE, QUESTION_SHAPES.BLANKS, () => [
          { id: optionId, optionText: "Answer", isCorrect: true, displayOrder: 1 },
        ])
        .with(QUESTION_SHAPES.SCALE, () => [
          { id: optionId, optionText: "Answer", isCorrect: true, displayOrder: 1, scaleAnswer: 3 },
        ])
        .with(QUESTION_SHAPES.MATCHING, () => [
          {
            id: optionId,
            optionText: "Answer",
            matchedWord: "Match",
            isCorrect: true,
            displayOrder: 1,
          },
          {
            optionText: "Second answer",
            matchedWord: "Second match",
            isCorrect: true,
            displayOrder: 2,
          },
        ])
        .exhaustive();

    const descriptionFor = (shape: QuestionShape, optionId: UUIDType) =>
      match(shape)
        .with(QUESTION_SHAPES.BLANKS, () => `Complete <blank-answer-${optionId}>.`)
        .otherwise(() => "Original description");

    const expectedDefinitionFor = (shape: QuestionShape) =>
      match(shape)
        .with(QUESTION_SHAPES.BLANKS, () => ({ blanks: [expect.anything()] }))
        .with(QUESTION_SHAPES.OPEN_TEXT, () => ({ openTextSettings: expect.anything() }))
        .otherwise(() => ({}));

    const arrangeQuestionOfType = (type: AssessmentQuestionType, shape: QuestionShape) => {
      const optionId = randomUUID();

      return arrangeAuthoredQuiz({
        title: "Question configuration regression",
        questions: [
          {
            type,
            title: "Original question",
            description: descriptionFor(shape, optionId),
            options: optionsFor(shape, optionId),
          },
        ],
      });
    };

    it.each(QUESTION_TYPE_CASES)(
      "keeps the $type configuration and identity when the question is edited and removed",
      async ({ type, shape }) => {
        const lesson = await arrangeQuestionOfType(type, shape);
        const question = await readFirstLegacyQuestion(lesson.id);

        await saveQuiz(lesson.id, {
          language: SUPPORTED_LANGUAGES.EN,
          questions: [{ ...question, title: "Edited question" }],
        });

        expect(await readFirstLegacyQuestion(lesson.id)).toMatchObject({
          id: question.id,
          type,
          title: "Edited question",
          description: question.description,
          options: question.options,
        });
        expect((await readQuizDefinition(lesson.id))?.questions[0]).toMatchObject(
          expectedDefinitionFor(shape),
        );

        await saveQuiz(lesson.id, { language: SUPPORTED_LANGUAGES.EN, questions: [] });

        expect((await readQuizDefinition(lesson.id))?.questions).toEqual([]);
      },
    );

    it("scores a scale answer and shows the learner's choice in the feedback", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const lesson = await arrangeQuestionOfType(
        ASSESSMENT_QUESTION_TYPES.SCALE_1_5,
        QUESTION_SHAPES.SCALE,
      );
      const question = await readFirstLegacyQuestion(lesson.id);
      const option = requirePresent(question.options?.[0], "scale option");

      const result = await runInTenant(() =>
        quizRuntimeService.submitQuiz(
          {
            lessonId: lesson.id,
            language: SUPPORTED_LANGUAGES.EN,
            questionsAnswers: [
              {
                questionId: requirePresent(question.id, "question id"),
                answers: [{ answerId: requirePresent(option.id, "option id") }],
              },
            ],
          },
          learner.id,
        ),
      );
      const feedback = await runInTenant(() =>
        quizRuntimeService.getQuizForDelivery(lesson.id, SUPPORTED_LANGUAGES.EN, learner.id, true),
      );

      expect(result).toMatchObject({ attemptNumber: 1, score: 100, passed: true });
      expect(feedback.questions[0].options?.[0]).toMatchObject({
        isStudentAnswer: true,
        scaleAnswer: 3,
      });
    });

    it("keeps the reviewer grading choice of open questions across an editor save", async () => {
      const lesson = await arrangeAuthoredQuiz({
        title: "Open questions grading",
        questions: [
          {
            type: ASSESSMENT_QUESTION_TYPES.BRIEF_RESPONSE,
            title: "Reviewed",
            requiresReview: true,
          },
          { type: ASSESSMENT_QUESTION_TYPES.DETAILED_RESPONSE, title: "Participation" },
        ],
      });
      const readGradingSetup = async () => {
        const quiz = await readLegacyQuiz(lesson.id);
        const gradingModes = await runInTenant(() =>
          db
            .select({ gradingMode: assessmentQuestions.gradingMode })
            .from(assessmentQuestions)
            .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
            .where(eq(assessments.lessonId, lesson.id))
            .orderBy(assessmentQuestions.displayOrder),
        );

        return {
          questions: quiz?.questions ?? [],
          gradingModes: gradingModes.map(({ gradingMode }) => gradingMode),
        };
      };
      const saveQuestions = (questions: AdminQuestionBody[]) =>
        saveQuiz(lesson.id, { language: SUPPORTED_LANGUAGES.EN, questions });

      const created = await readGradingSetup();

      expect(created.questions.map(({ requiresReview }) => requiresReview)).toEqual([true, false]);
      expect(created.gradingModes).toEqual([
        ASSESSMENT_GRADING_MODES.MANUAL,
        ASSESSMENT_GRADING_MODES.PARTICIPATION,
      ]);

      await saveQuestions(created.questions);

      expect((await readGradingSetup()).gradingModes).toEqual(created.gradingModes);

      await saveQuestions(
        created.questions.map((question) => ({ ...question, requiresReview: false })),
      );

      expect((await readGradingSetup()).gradingModes).toEqual([
        ASSESSMENT_GRADING_MODES.PARTICIPATION,
        ASSESSMENT_GRADING_MODES.PARTICIPATION,
      ]);
    });
  });

  describe("translated quizzes", () => {
    const arrangeTranslatedCapitalsQuiz = async () => {
      const lesson = await arrangeAuthoredQuiz({
        title: "Capital cities",
        availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
        questions: [
          {
            type: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
            title: "Capital of Poland?",
            options: [
              { optionText: "Warsaw", isCorrect: true, displayOrder: 1 },
              { optionText: "Paris", isCorrect: false, displayOrder: 2 },
            ],
          },
        ],
      });
      const englishQuestion = await readFirstLegacyQuestion(lesson.id, SUPPORTED_LANGUAGES.EN);

      await saveQuiz(lesson.id, {
        language: SUPPORTED_LANGUAGES.PL,
        title: "Stolice",
        questions: [
          {
            id: englishQuestion.id,
            type: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
            title: "Stolica Polski?",
            options: [
              { optionText: "Warszawa", isCorrect: true, displayOrder: 1 },
              { optionText: "Paryż", isCorrect: false, displayOrder: 2 },
            ],
          },
        ],
      });

      const polishQuestion = await readFirstLegacyQuestion(lesson.id, SUPPORTED_LANGUAGES.PL);
      const polishSubmission = {
        lessonId: lesson.id,
        language: SUPPORTED_LANGUAGES.PL,
        questionsAnswers: [
          {
            questionId: requirePresent(polishQuestion.id, "question id"),
            answers: [{ answerId: requirePresent(polishQuestion.options?.[0]?.id, "option id") }],
          },
        ],
      };

      return { lesson, englishQuestion, polishQuestion, polishSubmission };
    };

    it("keeps each language's text and falls back to the base language", async () => {
      const { lesson, englishQuestion } = await arrangeTranslatedCapitalsQuiz();

      const polish = await readLegacyQuiz(lesson.id, SUPPORTED_LANGUAGES.PL);
      const german = await readLegacyQuiz(lesson.id, SUPPORTED_LANGUAGES.DE);

      expect(englishQuestion.solutionExplanation).toBe("Warsaw");
      expect(polish).toMatchObject({
        title: "Stolice",
        questions: [
          { id: englishQuestion.id, title: "Stolica Polski?", solutionExplanation: "Warszawa" },
        ],
      });
      expect(german).toMatchObject({
        title: "Capital cities",
        questions: [{ solutionExplanation: "Warsaw" }],
      });
    });

    it("reveals localized feedback only after an attempt", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { lesson, polishSubmission } = await arrangeTranslatedCapitalsQuiz();
      const beforeAttempt = await runInTenant(() =>
        quizRuntimeService.getQuizForDelivery(lesson.id, SUPPORTED_LANGUAGES.PL, learner.id),
      );
      const attempt = await runInTenant(() =>
        quizRuntimeService.submitQuiz(polishSubmission, learner.id),
      );
      const afterAttempt = await runInTenant(() =>
        quizRuntimeService.getQuizForDelivery(lesson.id, SUPPORTED_LANGUAGES.PL, learner.id, true),
      );

      expect(beforeAttempt.questions[0].solutionExplanation).toBeNull();
      expect(attempt).toMatchObject({ attemptNumber: 1, score: 100, passed: true });
      expect(afterAttempt.questions[0]).toMatchObject({
        solutionExplanation: "Warszawa",
        options: expect.arrayContaining([
          expect.objectContaining({ isCorrect: true, isStudentAnswer: true }),
        ]),
      });
    });

    it("discards an attempt submitted inside a rolled back caller transaction", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { polishSubmission } = await arrangeTranslatedCapitalsQuiz();
      const firstAttempt = await runInTenant(() =>
        quizRuntimeService.submitQuiz(polishSubmission, learner.id),
      );

      await expect(
        runInTenant(() =>
          db.transaction(async (transaction) => {
            const attempt = await quizRuntimeService.submitQuiz(
              polishSubmission,
              learner.id,
              transaction,
            );
            expect(attempt.attemptNumber).toBe(2);
            throw new Error("Rollback quiz attempt");
          }),
        ),
      ).rejects.toThrow("Rollback quiz attempt");

      expect(await helpers.findLearnerAttempts(learner.id)).toEqual([
        expect.objectContaining({ id: firstAttempt.attemptId }),
      ]);
      expect(
        await runInTenant(() => quizRuntimeService.submitQuiz(polishSubmission, learner.id)),
      ).toMatchObject({ attemptNumber: 2 });
    });

    it("keeps option identities and the learner's answers when a translation is saved again", async () => {
      const learner = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const { lesson, polishQuestion, polishSubmission } = await arrangeTranslatedCapitalsQuiz();
      await runInTenant(() => quizRuntimeService.submitQuiz(polishSubmission, learner.id));

      await saveQuiz(lesson.id, {
        language: SUPPORTED_LANGUAGES.PL,
        questions: [{ ...polishQuestion, title: "Wybierz stolicę Polski" }],
      });
      const updatedQuestion = await readFirstLegacyQuestion(lesson.id, SUPPORTED_LANGUAGES.PL);
      const feedback = await runInTenant(() =>
        quizRuntimeService.getQuizForDelivery(lesson.id, SUPPORTED_LANGUAGES.PL, learner.id, true),
      );

      expect(updatedQuestion.options?.map(({ id }) => id)).toEqual(
        polishQuestion.options?.map(({ id }) => id),
      );
      expect(feedback.questions[0].options?.[0]).toMatchObject({ isStudentAnswer: true });
    });

    it("keeps translated feedback messages on their band when the base language edits bands", async () => {
      const lesson = await arrangeAuthoredQuiz({
        title: "Feedback bands",
        availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
        feedbackRanges: BASE_FEEDBACK_RANGES,
        questions: [
          {
            type: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
            title: "Capital of Poland?",
            options: [
              { optionText: "Warsaw", isCorrect: true, displayOrder: 1 },
              { optionText: "Paris", isCorrect: false, displayOrder: 2 },
            ],
          },
        ],
      });
      const readRanges = async (language: SupportedLanguages) =>
        (await readLegacyQuiz(lesson.id, language))?.feedbackRanges ?? [];
      const [low, high] = await readRanges(SUPPORTED_LANGUAGES.EN);

      expect([low, high]).toMatchObject([
        { minPercent: 0, maxPercent: 49, message: "Low" },
        { minPercent: 50, maxPercent: 100, message: "High" },
      ]);

      await saveQuiz(lesson.id, {
        language: SUPPORTED_LANGUAGES.PL,
        feedbackRanges: [
          { ...low, message: "Nisko" },
          { ...high, message: "Wysoko" },
        ],
      });

      await expect(
        saveQuiz(lesson.id, {
          language: SUPPORTED_LANGUAGES.PL,
          feedbackRanges: [
            { ...low, maxPercent: 59, message: "Nisko" },
            { ...high, minPercent: 60, message: "Wysoko" },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      await saveQuiz(lesson.id, {
        language: SUPPORTED_LANGUAGES.EN,
        feedbackRanges: [
          { ...low, maxPercent: 29 },
          { minPercent: 30, maxPercent: 69, message: "Middle" },
          { ...high, minPercent: 70 },
        ],
      });
      const withMiddleBand = await readRanges(SUPPORTED_LANGUAGES.PL);

      expect(withMiddleBand).toMatchObject([
        { id: low.id, minPercent: 0, message: "Nisko" },
        { minPercent: 30, maxPercent: 69 },
        { id: high.id, minPercent: 70, message: "Wysoko" },
      ]);
      expect(withMiddleBand[1].message).not.toBe("Wysoko");

      await saveQuiz(lesson.id, {
        language: SUPPORTED_LANGUAGES.EN,
        feedbackRanges: [
          { ...high, minPercent: 0, maxPercent: 49 },
          { ...low, minPercent: 50, maxPercent: 100 },
        ],
      });

      expect(await readRanges(SUPPORTED_LANGUAGES.PL)).toMatchObject([
        { id: high.id, minPercent: 0, maxPercent: 49, message: "Wysoko" },
        { id: low.id, minPercent: 50, maxPercent: 100, message: "Nisko" },
      ]);
    });
  });
});
