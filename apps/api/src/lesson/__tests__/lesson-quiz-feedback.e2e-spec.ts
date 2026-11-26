import {
  ASSESSMENT_ANSWER_GRADING_STATUSES,
  ASSESSMENT_FEEDBACK_MODES,
  QUIZ_REVIEW_GRADING_METHODS,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { assessmentAttemptQuestionAnswers } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createAssessmentFeedbackRangeFactory } from "../../../test/factory/quiz-assessment.factory";
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
  FEEDBACK_MODE_CASES,
  FEEDBACK_RANGES,
  LEARNER_FIRST_NAME,
  LESSON_FEEDBACK_REDACTION_CASES,
  QUIZ_VIEWERS,
  TOP_BAND_MESSAGE,
} from "./lesson-quiz-feedback.scenarios";

import type { QuizViewer } from "./lesson-quiz-feedback.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { AssessmentFeedbackMode } from "@repo/shared";
import type { DatabasePg } from "src/common";
import type { QuizAnswers } from "test/helpers/lesson";

const fileServiceMock = createFileServiceMock();
const cacheManagerMock = createCacheManagerMock();

type DeliveredQuestion = {
  passQuestion: boolean | null;
  solutionExplanation: string | null;
  options?: Array<{ isCorrect: boolean | null }>;
};

const revealsCorrectAnswer = (questions: DeliveredQuestion[]) =>
  questions.some(
    ({ passQuestion, solutionExplanation, options = [] }) =>
      passQuestion === true ||
      solutionExplanation !== null ||
      options.some(({ isCorrect }) => isCorrect === true),
  );

describe("Lesson quiz feedback (e2e)", () => {
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

  const arrangeEnrolledStudentQuiz = async ({
    quizFeedbackEnabled = true,
    feedbackMode,
  }: { quizFeedbackEnabled?: boolean; feedbackMode?: AssessmentFeedbackMode } = {}) => {
    const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    const student = await helpers.arrangeSignedInStudent({ firstName: LEARNER_FIRST_NAME });
    const quiz = await helpers.arrangeQuizCourse({
      authorId: author.id,
      quizFeedbackEnabled,
      feedbackMode,
    });
    await helpers.arrangeEnrollment(student.user.id, quiz.course.id);

    return { student, quiz };
  };

  describe("GET /api/lesson/:id - quiz feedback redaction", () => {
    const arrangeViewerOfQuiz = (viewer: QuizViewer, quizFeedbackEnabled: boolean) =>
      match(viewer)
        .with(QUIZ_VIEWERS.ENROLLED_STUDENT, async () => {
          const { student, quiz } = await arrangeEnrolledStudentQuiz({ quizFeedbackEnabled });

          return { viewer: student, quiz };
        })
        .with(QUIZ_VIEWERS.ADMIN_AFTER_ATTEMPT, async () => {
          const author = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
          const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
          const quiz = await helpers.arrangeQuizCourse({
            authorId: author.id,
            quizFeedbackEnabled,
          });

          return { viewer: admin, quiz };
        })
        .with(QUIZ_VIEWERS.AUTHOR_AFTER_ATTEMPT, async () => {
          const author = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
          const quiz = await helpers.arrangeQuizCourse({
            authorId: author.user.id,
            quizFeedbackEnabled,
          });

          return { viewer: author, quiz };
        })
        .exhaustive();

    const attemptInLearningMode = async (
      viewer: QuizViewer,
      arranged: Awaited<ReturnType<typeof arrangeViewerOfQuiz>>,
    ) =>
      match(viewer)
        .with(QUIZ_VIEWERS.ENROLLED_STUDENT, async () => undefined)
        .with(QUIZ_VIEWERS.ADMIN_AFTER_ATTEMPT, QUIZ_VIEWERS.AUTHOR_AFTER_ATTEMPT, async () => {
          await helpers.arrangeLearningMode(arranged.viewer.user.id, arranged.quiz.course.id);
          await helpers
            .submitQuizAnswers(
              arranged.viewer,
              arranged.quiz.lesson.id,
              correctAnswersFor(arranged.quiz),
            )
            .expect(201);
        })
        .exhaustive();

    it.each(LESSON_FEEDBACK_REDACTION_CASES)(
      "redacts feedback ($expectedRedacted) for $viewer when quiz feedback enabled is $quizFeedbackEnabled",
      async ({ viewer, quizFeedbackEnabled, expectedRedacted, expectedRevealsCorrectAnswer }) => {
        const arranged = await arrangeViewerOfQuiz(viewer, quizFeedbackEnabled);
        await attemptInLearningMode(viewer, arranged);

        const lessonData = await helpers.fetchLesson(arranged.viewer, arranged.quiz.lesson.id);

        expect(lessonData).toMatchObject({
          isQuizFeedbackRedacted: expectedRedacted,
          thresholdScore: 70,
          videoCompletionTrackingEnabled: true,
          quizDetails: { questions: [expect.objectContaining({ options: expect.any(Array) })] },
        });
        expect(revealsCorrectAnswer(lessonData.quizDetails.questions)).toBe(
          expectedRevealsCorrectAnswer,
        );
      },
    );

    it("redacts feedback once the course turns quiz feedback off", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const student = await helpers.arrangeSignedInStudent();
      const quiz = await helpers.arrangeQuizCourse({ authorId: admin.user.id });
      await helpers.arrangeEnrollment(student.user.id, quiz.course.id);

      const beforeChange = await helpers.fetchLesson(student, quiz.lesson.id);
      await request(app.getHttpServer())
        .patch(`/api/course/settings/${quiz.course.id}`)
        .set("Cookie", admin.cookies)
        .send({ quizFeedbackEnabled: false })
        .expect(200);
      const afterChange = await helpers.fetchLesson(student, quiz.lesson.id);

      expect(beforeChange).toMatchObject({ isQuizFeedbackRedacted: false });
      expect(afterChange).toMatchObject({ isQuizFeedbackRedacted: true });
    });
  });

  describe("POST /api/lesson/evaluation-quiz - quiz feedback", () => {
    it.each([{ quizFeedbackEnabled: false }, { quizFeedbackEnabled: true }])(
      "returns the student's score when quiz feedback enabled is $quizFeedbackEnabled",
      async ({ quizFeedbackEnabled }) => {
        const { student, quiz } = await arrangeEnrolledStudentQuiz({ quizFeedbackEnabled });

        const response = await helpers
          .submitQuizAnswers(student, quiz.lesson.id, correctAnswersFor(quiz))
          .expect(201);

        expect(response.body.data.data).toMatchObject({
          correctAnswerCount: 1,
          wrongAnswerCount: 0,
          score: 100,
          questionCount: 1,
        });
      },
    );
  });

  describe("GET /api/lesson/:id - author feedback range message", () => {
    const arrangeFeedbackQuiz = async (feedbackMode: AssessmentFeedbackMode) => {
      const { student, quiz } = await arrangeEnrolledStudentQuiz({ feedbackMode });
      await runInTenant(async () => {
        for (const [displayOrder, range] of FEEDBACK_RANGES.entries()) {
          await createAssessmentFeedbackRangeFactory(db).create({
            ...range,
            assessmentId: quiz.assessment.id,
            displayOrder,
          });
        }
      });

      return { student, quiz, answers: correctAnswersFor(quiz) };
    };

    const arrangeFeedbackQuizWithOpenQuestion = async () => {
      const arranged = await arrangeFeedbackQuiz(ASSESSMENT_FEEDBACK_MODES.FULL);
      const openQuestion = await helpers.arrangeOpenTextQuestion(arranged.quiz.assessment.id);
      const answers: QuizAnswers = [
        ...arranged.answers,
        { questionId: openQuestion.id, answers: [{ value: "My open answer" }] },
      ];

      return { ...arranged, answers };
    };

    it.each(FEEDBACK_MODE_CASES)(
      "shows the band message $expectedFeedbackMessage in $feedbackMode mode",
      async ({
        feedbackMode,
        expectedRedacted,
        expectedRevealsCorrectAnswer,
        expectedFeedbackMessage,
      }) => {
        const { student, quiz, answers } = await arrangeFeedbackQuiz(feedbackMode);
        await helpers.submitQuizAnswers(student, quiz.lesson.id, answers).expect(201);

        const lessonData = await helpers.fetchLesson(student, quiz.lesson.id);

        expect(lessonData.isQuizFeedbackRedacted).toBe(expectedRedacted);
        expect(lessonData.quizDetails.feedbackMessage ?? null).toBe(expectedFeedbackMessage);
        expect(revealsCorrectAnswer(lessonData.quizDetails.questions)).toBe(
          expectedRevealsCorrectAnswer,
        );
      },
    );

    it("withholds the band message until a reviewer grades the open answer", async () => {
      const { student, quiz, answers } = await arrangeFeedbackQuizWithOpenQuestion();
      await helpers.submitQuizAnswers(student, quiz.lesson.id, answers).expect(201);

      const pending = await helpers.fetchLesson(student, quiz.lesson.id);

      expect(pending).toMatchObject({ isQuizAwaitingReview: true });
      expect(pending.quizDetails.feedbackMessage ?? null).toBeNull();
    });

    it("shows the band message once a reviewer grades the open answer", async () => {
      const { student, quiz, answers } = await arrangeFeedbackQuizWithOpenQuestion();
      await helpers.submitQuizAnswers(student, quiz.lesson.id, answers).expect(201);
      const reviewer = await helpers.arrangeSignedInReviewer();
      const [openAnswer] = await runInTenant(() =>
        db
          .select({ id: assessmentAttemptQuestionAnswers.id })
          .from(assessmentAttemptQuestionAnswers)
          .where(
            eq(
              assessmentAttemptQuestionAnswers.gradingStatus,
              ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING,
            ),
          ),
      );

      await request(app.getHttpServer())
        .post(`/api/quiz-grading/answers/${openAnswer.id}/grade`)
        .set("Cookie", reviewer.cookies)
        .send({ method: QUIZ_REVIEW_GRADING_METHODS.PASS_FAIL, passed: true })
        .expect(201);
      const graded = await helpers.fetchLesson(student, quiz.lesson.id);

      expect(graded).toMatchObject({
        lessonCompleted: true,
        isQuizAwaitingReview: false,
        quizDetails: { feedbackMessage: TOP_BAND_MESSAGE },
      });
    });
  });
});
