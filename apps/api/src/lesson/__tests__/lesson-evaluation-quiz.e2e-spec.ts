import {
  ASSESSMENT_ANSWER_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_FEEDBACK_MODES,
  LEARNER_PROGRESS_STATUSES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { LEARNING_MODE_REQUIRED_ERROR_KEY } from "src/common/utils/lessonLearningAccess";
import { QuizCompletedEvent } from "src/events";
import { FileService } from "src/file/file.service";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  assessmentAttemptOpenTextAnswers,
  assessmentAttemptQuestionAnswers,
  assessmentQuestions,
  assessments,
  outboxEvents,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { getCourseLessonStatus } from "../../../test/helpers/course-lesson-status";
import {
  LESSON_TABLES,
  correctAnswersFor,
  createCacheManagerMock,
  createFileServiceMock,
  createLessonHelpers,
  resetCacheManagerMock,
  resetFileServiceMock,
} from "../../../test/helpers/lesson";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  LEARNING_MODE_SUBMISSION_CASES,
  OPEN_ANSWER,
  QUIZ_SUBMITTERS,
  SUBMISSION_OUTCOMES,
} from "./lesson-evaluation-quiz.scenarios";

import type { QuizSubmitter } from "./lesson-evaluation-quiz.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { QuizAnswers } from "test/helpers/lesson";

const fileServiceMock = createFileServiceMock();
const cacheManagerMock = createCacheManagerMock();

type DeliveredQuestion = {
  id: UUIDType;
  passQuestion: boolean | null;
  solutionExplanation: string | null;
  options: Array<{ isCorrect: boolean | null; isStudentAnswer: boolean; studentAnswer?: string }>;
};

describe("Quiz evaluation (e2e)", () => {
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

  const arrangeEnrolledStudentQuiz = async ({ quizFeedbackEnabled = true } = {}) => {
    const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    const student = await helpers.arrangeSignedInStudent();
    const quiz = await helpers.arrangeQuizCourse({ authorId: author.id, quizFeedbackEnabled });
    await helpers.arrangeEnrollment(student.user.id, quiz.course.id);

    return { student, quiz };
  };

  describe("POST /api/lesson/evaluation-quiz - learning mode", () => {
    const arrangeSubmitter = async (submitter: QuizSubmitter) => {
      const arrangeOthersQuiz = async () => {
        const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);

        return helpers.arrangeQuizCourse({ authorId: author.id });
      };

      return match(submitter)
        .with(QUIZ_SUBMITTERS.ENROLLED_CONTENT_CREATOR, async () => {
          const actor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
          const quiz = await arrangeOthersQuiz();
          await helpers.arrangeEnrollment(actor.user.id, quiz.course.id);

          return { actor, quiz };
        })
        .with(QUIZ_SUBMITTERS.ENROLLED_AUTHOR, async () => {
          const actor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
          const quiz = await helpers.arrangeQuizCourse({ authorId: actor.user.id });
          await helpers.arrangeEnrollment(actor.user.id, quiz.course.id);

          return { actor, quiz };
        })
        .with(QUIZ_SUBMITTERS.AUTHOR_IN_LEARNING_MODE, async () => {
          const actor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
          const quiz = await helpers.arrangeQuizCourse({ authorId: actor.user.id });
          await helpers.arrangeLearningMode(actor.user.id, quiz.course.id);

          return { actor, quiz };
        })
        .with(QUIZ_SUBMITTERS.ADMIN, async () => {
          const actor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);

          return { actor, quiz: await arrangeOthersQuiz() };
        })
        .with(QUIZ_SUBMITTERS.ADMIN_IN_LEARNING_MODE, async () => {
          const actor = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
          const quiz = await arrangeOthersQuiz();
          await helpers.arrangeLearningMode(actor.user.id, quiz.course.id);

          return { actor, quiz };
        })
        .exhaustive();
    };

    it.each(LEARNING_MODE_SUBMISSION_CASES)(
      "is $outcome for $submitter",
      async ({ submitter, outcome }) => {
        const { actor, quiz } = await arrangeSubmitter(submitter);

        const submission = helpers.submitQuizAnswers(
          actor,
          quiz.lesson.id,
          correctAnswersFor(quiz),
        );

        await match(outcome)
          .with(SUBMISSION_OUTCOMES.GRADED, async () => {
            const response = await submission.expect(201);

            expect(response.body.data.data).toMatchObject({ score: 100 });
            expect(await helpers.findLessonProgress(actor.user.id, quiz.lesson.id)).toEqual([
              expect.objectContaining({ completedAt: expect.any(String), isQuizPassed: true }),
            ]);
          })
          .with(SUBMISSION_OUTCOMES.LEARNING_MODE_REQUIRED, async () => {
            const response = await submission.expect(403);

            expect(response.body).toMatchObject({ message: LEARNING_MODE_REQUIRED_ERROR_KEY });
          })
          .exhaustive();
      },
    );
  });

  describe("POST /api/lesson/evaluation-quiz - open answers awaiting review", () => {
    const arrangeQuizWithOpenQuestion = async ({ quizFeedbackEnabled = true } = {}) => {
      const { student, quiz } = await arrangeEnrolledStudentQuiz({ quizFeedbackEnabled });
      const openQuestion = await helpers.arrangeOpenTextQuestion(quiz.assessment.id);
      const choiceAnswers = correctAnswersFor(quiz);
      const answers: QuizAnswers = [
        ...choiceAnswers,
        { questionId: openQuestion.id, answers: [{ value: OPEN_ANSWER }] },
      ];

      return { student, quiz, openQuestion, choiceAnswers, answers };
    };

    const findAttemptAnswers = (attemptId: UUIDType) =>
      runInTenant(() =>
        db
          .select({
            questionId: assessmentAttemptQuestionAnswers.questionId,
            gradingStatus: assessmentAttemptQuestionAnswers.gradingStatus,
            awardedPoints: assessmentAttemptQuestionAnswers.awardedPoints,
            submittedText: assessmentAttemptOpenTextAnswers.submittedText,
          })
          .from(assessmentAttemptQuestionAnswers)
          .leftJoin(
            assessmentAttemptOpenTextAnswers,
            eq(
              assessmentAttemptOpenTextAnswers.questionAnswerId,
              assessmentAttemptQuestionAnswers.id,
            ),
          )
          .where(eq(assessmentAttemptQuestionAnswers.attemptId, attemptId)),
      );

    const findPublishedEventTypes = () =>
      runInTenant(async () =>
        (await db.select({ eventType: outboxEvents.eventType }).from(outboxEvents)).map(
          ({ eventType }) => eventType,
        ),
      );

    it("keeps the attempt pending and the lesson incomplete without a quiz completed event", async () => {
      const { student, quiz, openQuestion, answers } = await arrangeQuizWithOpenQuestion();

      const response = await helpers
        .submitQuizAnswers(student, quiz.lesson.id, answers)
        .expect(201);
      const [attempt] = await helpers.findLearnerAttempts(student.user.id);

      expect(response.body.data.data).toMatchObject({ awaitingReview: true, score: 0 });
      expect(await findPublishedEventTypes()).not.toContain(QuizCompletedEvent.name);
      expect(attempt).toMatchObject({
        gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.PENDING,
        result: ASSESSMENT_ATTEMPT_RESULTS.PENDING,
        gradedAt: null,
        awardedPoints: null,
        scorePercentage: null,
      });
      expect(await findAttemptAnswers(attempt.id)).toEqual(
        expect.arrayContaining([
          {
            questionId: openQuestion.id,
            gradingStatus: ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING,
            awardedPoints: "0.00",
            submittedText: OPEN_ANSWER,
          },
          expect.objectContaining({
            questionId: quiz.question.id,
            gradingStatus: ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED,
          }),
        ]),
      );
      expect(await helpers.findLessonProgress(student.user.id, quiz.lesson.id)).toEqual([
        expect.objectContaining({ completedAt: null, isQuizPassed: false, attempts: 1 }),
      ]);
      expect(
        await runInTenant(() => app.get(StatisticsRepository).getQuizStats(student.user.id)),
      ).toMatchObject({ totalAttempts: 0, averageScore: 0 });
    });

    it("shows graded questions with correctness and open answers waiting for review", async () => {
      const { student, quiz, openQuestion, choiceAnswers, answers } =
        await arrangeQuizWithOpenQuestion();
      await helpers.submitQuizAnswers(student, quiz.lesson.id, answers).expect(201);

      const lessonData = await helpers.fetchLesson(student, quiz.lesson.id);
      const questions: DeliveredQuestion[] = lessonData.quizDetails.questions;

      expect(lessonData).toMatchObject({
        lessonCompleted: false,
        isQuizAwaitingReview: true,
        isQuizFeedbackRedacted: false,
        quizDetails: {
          score: null,
          correctAnswerCount: choiceAnswers.length,
          wrongAnswerCount: 0,
        },
      });
      expect(questions.find(({ id }) => id === openQuestion.id)).toMatchObject({
        passQuestion: null,
        solutionExplanation: null,
        options: [{ isCorrect: null, studentAnswer: OPEN_ANSWER }],
      });
      expect(questions.find(({ id }) => id === quiz.question.id)).toMatchObject({
        passQuestion: true,
      });
      expect(
        await getCourseLessonStatus(app, student.cookies, quiz.course.id, quiz.lesson.id),
      ).toBe(LEARNER_PROGRESS_STATUSES.AWAITING_REVIEW);
    });

    it("keeps the graded count in score_only mode while redacting per-question correctness", async () => {
      const { student, quiz, choiceAnswers, answers } = await arrangeQuizWithOpenQuestion();
      await runInTenant(() =>
        db
          .update(assessments)
          .set({ feedbackMode: ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY })
          .where(eq(assessments.id, quiz.assessment.id)),
      );
      await helpers.submitQuizAnswers(student, quiz.lesson.id, answers).expect(201);

      const lessonData = await helpers.fetchLesson(student, quiz.lesson.id);
      const questions: DeliveredQuestion[] = lessonData.quizDetails.questions;

      expect(lessonData).toMatchObject({
        isQuizAwaitingReview: true,
        isQuizFeedbackRedacted: true,
        quizDetails: {
          score: null,
          correctAnswerCount: choiceAnswers.length,
          wrongAnswerCount: 0,
        },
      });
      expect(questions.some(({ passQuestion }) => passQuestion === true)).toBe(false);
    });

    it("hides the partial result when quiz feedback is disabled", async () => {
      const { student, quiz, answers } = await arrangeQuizWithOpenQuestion({
        quizFeedbackEnabled: false,
      });
      await helpers.submitQuizAnswers(student, quiz.lesson.id, answers).expect(201);

      const lessonData = await helpers.fetchLesson(student, quiz.lesson.id);
      const questions: DeliveredQuestion[] = lessonData.quizDetails.questions;
      const options = questions.flatMap((question) => question.options);

      expect(lessonData).toMatchObject({
        lessonCompleted: false,
        isQuizAwaitingReview: true,
        isQuizFeedbackRedacted: true,
        quizDetails: { score: null, correctAnswerCount: null, wrongAnswerCount: null },
      });
      expect(questions.some(({ passQuestion }) => passQuestion === true)).toBe(false);
      expect(options.some(({ isCorrect }) => isCorrect === true)).toBe(false);
      expect(options.some(({ isStudentAnswer }) => isStudentAnswer)).toBe(true);
    });

    it("blocks resubmitting and retaking while the quiz awaits review", async () => {
      const { student, quiz, answers } = await arrangeQuizWithOpenQuestion();
      await helpers.submitQuizAnswers(student, quiz.lesson.id, answers).expect(201);

      const resubmission = await helpers
        .submitQuizAnswers(student, quiz.lesson.id, answers)
        .expect(409);
      const retake = await request(app.getHttpServer())
        .delete("/api/lesson/delete-student-quiz-answers")
        .query({ lessonId: quiz.lesson.id })
        .set("Cookie", student.cookies)
        .expect(409);

      expect(resubmission.body).toMatchObject({
        message: "studentLessonView.validation.quizAwaitingReview",
      });
      expect(retake.body).toMatchObject({
        message: "studentLessonView.validation.quizAwaitingReview",
      });
    });

    it("grades quizzes without manual questions immediately", async () => {
      const { student, quiz, openQuestion } = await arrangeQuizWithOpenQuestion();
      await runInTenant(() =>
        db.delete(assessmentQuestions).where(eq(assessmentQuestions.id, openQuestion.id)),
      );

      const response = await helpers
        .submitQuizAnswers(student, quiz.lesson.id, correctAnswersFor(quiz))
        .expect(201);
      const [attempt] = await helpers.findLearnerAttempts(student.user.id);

      expect(response.body.data.data).toMatchObject({ awaitingReview: false, score: 100 });
      expect(attempt).toMatchObject({
        gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
        gradedAt: expect.any(String),
      });
    });
  });

  describe("GET /api/course - quiz lesson status after a graded attempt", () => {
    it("reports failed after a failed attempt, keeps it during a retake and completes once a retake passes", async () => {
      const { student, quiz } = await arrangeEnrolledStudentQuiz();
      const lessonStatus = () =>
        getCourseLessonStatus(app, student.cookies, quiz.course.id, quiz.lesson.id);

      await helpers
        .submitQuizAnswers(student, quiz.lesson.id, [
          { questionId: quiz.question.id, answers: [{ answerId: quiz.wrongOptionId }] },
        ])
        .expect(201);

      expect(await lessonStatus()).toBe(LEARNER_PROGRESS_STATUSES.FAILED);

      await request(app.getHttpServer())
        .delete("/api/lesson/delete-student-quiz-answers")
        .query({ lessonId: quiz.lesson.id })
        .set("Cookie", student.cookies)
        .expect(200);

      expect(await lessonStatus()).toBe(LEARNER_PROGRESS_STATUSES.FAILED);

      await helpers.submitQuizAnswers(student, quiz.lesson.id, correctAnswersFor(quiz)).expect(201);

      expect(await lessonStatus()).toBe(LEARNER_PROGRESS_STATUSES.COMPLETED);
    });
  });
});
