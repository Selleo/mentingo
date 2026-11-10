import {
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES,
  ASSESSMENT_GRADING_MODES,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_TIME_LIMIT_MINUTES,
  ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS,
  COURSE_ENROLLMENT,
  QUIZ_ATTEMPT_START_STATUSES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { and, eq, sql } from "drizzle-orm";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QuizAttemptExpirationWorker } from "src/lesson/quiz-attempt-expiration.worker";
import { LessonService } from "src/lesson/services/lesson.service";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { QuizAttemptService } from "src/quiz/services/quiz-attempt.service";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  assessmentAttemptQuestionAnswers,
  assessmentAttempts,
  assessmentQuestionChoiceOptions,
  assessmentQuestions,
  assessments,
  chapters,
  lessons,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

describe("Timed quiz attempts (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let enqueueSpy: jest.SpyInstance;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  const password = "password123";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest([
      { provide: QuizAttemptExpirationWorker, useValue: {} },
    ]);

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    enqueueSpy = jest.spyOn(app.get(QueueService), "enqueue").mockResolvedValue({} as never);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    enqueueSpy.mockClear();
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateTables(baseDb, [
      "assessment_attempts",
      "assessment_questions",
      "assessment_question_choice_options",
      "assessments",
      "courses",
      "chapters",
      "lessons",
      "student_lesson_progress",
      "student_chapter_progress",
      "student_courses",
      "users",
      "categories",
      "settings",
    ]);
  });

  const setupQuiz = async (timeLimitMinutes: number | null) => {
    const category = await categoryFactory.create();
    const author = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR });
    const student = await userFactory
      .withCredentials({ password })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const cookies = await cookieFor(student, app);
    const course = await courseFactory.create({
      authorId: author.id,
      categoryId: category.id,
      status: "published",
      settings: { lessonSequenceEnabled: false, quizFeedbackEnabled: true },
    });
    const chapter = await chapterFactory.create({ courseId: course.id });
    await db.update(chapters).set({ lessonCount: 1 }).where(eq(chapters.id, chapter.id));
    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
    });

    const [lesson] = await db
      .insert(lessons)
      .values({
        chapterId: chapter.id,
        type: LESSON_TYPES.QUIZ,
        title: buildJsonbField("en", "Timed quiz"),
        description: buildJsonbField("en", "Timed quiz"),
        thresholdScore: 50,
        displayOrder: 1,
      })
      .returning();
    const [assessment] = await db
      .insert(assessments)
      .values({
        lessonId: lesson.id,
        passingScorePercentage: "50",
        timeLimitMinutes,
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales: [SUPPORTED_LANGUAGES.EN],
      })
      .returning();

    const createQuestion = async (displayOrder: number) => {
      const [question] = await db
        .insert(assessmentQuestions)
        .values({
          assessmentId: assessment.id,
          questionType: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
          gradingMode: ASSESSMENT_GRADING_MODES.AUTOMATIC,
          prompt: buildJsonbField("en", `Question ${displayOrder}`),
          title: buildJsonbField("en", `Question ${displayOrder}`),
          displayOrder,
        })
        .returning();
      const [correct, wrong] = await db
        .insert(assessmentQuestionChoiceOptions)
        .values([
          {
            questionId: question.id,
            language: SUPPORTED_LANGUAGES.EN,
            label: "correct",
            isCorrect: true,
            displayOrder: 1,
          },
          {
            questionId: question.id,
            language: SUPPORTED_LANGUAGES.EN,
            label: "wrong",
            isCorrect: false,
            displayOrder: 2,
          },
        ])
        .returning();
      return { questionId: question.id, correctId: correct.id, wrongId: wrong.id };
    };

    const questions = [await createQuestion(1), await createQuestion(2)];
    const allCorrect = questions.map(({ questionId, correctId }) => ({
      questionId,
      answers: [{ answerId: correctId }],
    }));

    return { student, cookies, lesson, assessment, questions, allCorrect };
  };

  const startAttempt = (cookies: string, lessonId: UUIDType) =>
    request(app.getHttpServer())
      .post("/api/lesson/quiz-attempt/start")
      .set("Cookie", cookies)
      .send({ lessonId, language: "en" });

  const startAttemptState = async (cookies: string, lessonId: UUIDType) => {
    const response = await startAttempt(cookies, lessonId).expect(201);
    expect(response.body.data.status).toBe(QUIZ_ATTEMPT_START_STATUSES.IN_PROGRESS);
    return response.body.data.attempt;
  };

  const getLessonView = (cookies: string, lessonId: UUIDType) =>
    request(app.getHttpServer())
      .get(`/api/lesson/${lessonId}`)
      .query({ language: "en" })
      .set("Cookie", cookies);

  const saveDraft = (
    cookies: string,
    lessonId: UUIDType,
    attemptId: UUIDType,
    questionsAnswers: unknown[],
  ) =>
    request(app.getHttpServer())
      .put("/api/lesson/quiz-attempt/draft")
      .set("Cookie", cookies)
      .send({ lessonId, attemptId, questionsAnswers });

  const submit = (cookies: string, lessonId: UUIDType, questionsAnswers: unknown[]) =>
    request(app.getHttpServer())
      .post("/api/lesson/evaluation-quiz")
      .set("Cookie", cookies)
      .send({ lessonId, language: "en", questionsAnswers });

  const expireAttempt = (attemptId: UUIDType, secondsAgo: number) =>
    db
      .update(assessmentAttempts)
      .set({ expiresAt: sql`now() - make_interval(secs => ${secondsAgo}::int)` })
      .where(eq(assessmentAttempts.id, attemptId));

  const getAttempts = (assessmentId: UUIDType) =>
    db
      .select()
      .from(assessmentAttempts)
      .where(eq(assessmentAttempts.assessmentId, assessmentId))
      .orderBy(assessmentAttempts.attemptNumber);

  const getProgress = async (studentId: UUIDType, lessonId: UUIDType) => {
    const [progress] = await db
      .select()
      .from(studentLessonProgress)
      .where(
        and(
          eq(studentLessonProgress.studentId, studentId),
          eq(studentLessonProgress.lessonId, lessonId),
        ),
      );
    return progress;
  };

  const actorFor = (student: { id: UUIDType; email: string; tenantId: UUIDType }) =>
    ({
      userId: student.id,
      email: student.email,
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
      permissions: SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.STUDENT],
      tenantId: student.tenantId,
    }) as CurrentUserType;

  const GRACE_MS = ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS * 1000;
  const pastGrace = ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS + 10;
  const draftWithFirstCorrect = (
    questions: Array<{ questionId: UUIDType; correctId: UUIDType }>,
  ) => [{ questionId: questions[0].questionId, answers: [{ answerId: questions[0].correctId }] }];

  it("lets authors set, keep, validate and clear the quiz time limit", async () => {
    const { lesson, assessment, questions } = await setupQuiz(null);
    const legacyQuestions = questions.map(({ questionId, correctId, wrongId }, index) => ({
      id: questionId,
      type: QUESTION_TYPE.SINGLE_CHOICE,
      title: `Question ${index + 1}`,
      displayOrder: index + 1,
      options: [
        { id: correctId, optionText: "correct", isCorrect: true, displayOrder: 1 },
        { id: wrongId, optionText: "wrong", isCorrect: false, displayOrder: 2 },
      ],
    }));
    const admin = await userFactory
      .withCredentials({ password })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const adminCookies = await cookieFor(admin, app);
    const updateQuiz = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .patch("/api/lesson/beta-update-lesson/quiz")
        .query({ id: lesson.id })
        .set("Cookie", adminCookies)
        .send({ language: "en", questions: legacyQuestions, ...body });
    const storedLimit = async () =>
      (
        await db
          .select({ timeLimitMinutes: assessments.timeLimitMinutes })
          .from(assessments)
          .where(eq(assessments.id, assessment.id))
      )[0].timeLimitMinutes;

    await updateQuiz({ timeLimitMinutes: 20 }).expect(200);
    expect(await storedLimit()).toBe(20);

    await updateQuiz({ title: "Renamed quiz" }).expect(200);
    expect(await storedLimit()).toBe(20);

    await updateQuiz({ timeLimitMinutes: ASSESSMENT_TIME_LIMIT_MINUTES.MAX + 1 }).expect(400);
    expect(await storedLimit()).toBe(20);

    await updateQuiz({ timeLimitMinutes: null }).expect(200);
    expect(await storedLimit()).toBeNull();
  });

  it("keeps untimed quizzes on the existing submit flow", async () => {
    const { cookies, lesson, assessment, allCorrect } = await setupQuiz(null);

    const start = await startAttempt(cookies, lesson.id).expect(400);
    expect(start.body.message).toBe("studentLessonView.validation.quizNotTimed");

    const partial = await submit(cookies, lesson.id, allCorrect.slice(0, 1)).expect(400);
    expect(partial.body.message).toBe("studentLessonView.validation.quizEvaluationFailed");

    const response = await submit(cookies, lesson.id, allCorrect).expect(201);
    expect(response.body.data.data.score).toBe(100);

    const [attempt] = await getAttempts(assessment.id);
    expect(attempt.submissionStatus).toBe(ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED);
    expect(attempt.expiresAt).toBeNull();
  });

  it("starts, resumes and exposes the open attempt on the lesson view", async () => {
    const { cookies, lesson, assessment } = await setupQuiz(10);

    const state = await startAttemptState(cookies, lesson.id);

    expect(new Date(state.expiresAt).getTime() - new Date(state.startedAt).getTime()).toBe(
      10 * 60 * 1000,
    );
    expect(state.submitGraceSeconds).toBe(ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS);
    expect(state.draftAnswers).toEqual([]);
    expect(enqueueSpy).toHaveBeenCalledWith(
      QUEUE_NAMES.QUIZ_ATTEMPT_EXPIRATION,
      expect.any(String),
      expect.objectContaining({ attemptId: state.attemptId }),
      expect.objectContaining({ jobId: state.attemptId }),
    );
    const expectedDelay = 10 * 60 * 1000 + GRACE_MS + 1000;
    const { delay } = enqueueSpy.mock.calls[0][3];
    // expiresAt comes from the DB clock and the delay from Node's, so allow a small skew
    expect(delay).toBeLessThanOrEqual(expectedDelay + 1000);
    expect(delay).toBeGreaterThan(expectedDelay - 10_000);

    const resumed = await startAttemptState(cookies, lesson.id);
    expect(resumed.attemptId).toBe(state.attemptId);
    expect(await getAttempts(assessment.id)).toHaveLength(1);
    expect(enqueueSpy).toHaveBeenCalledTimes(2);
    expect(enqueueSpy.mock.calls[1][3]).toMatchObject({ jobId: state.attemptId });

    const lessonView = await getLessonView(cookies, lesson.id).expect(200);

    expect(lessonView.body.data.timeLimitMinutes).toBe(10);
    expect(lessonView.body.data.quizAttempt.attemptId).toBe(state.attemptId);
    expect(lessonView.body.data.lessonCompleted).toBe(false);
  });

  it("still starts the attempt when scheduling the expiration job fails", async () => {
    const { cookies, lesson } = await setupQuiz(10);
    enqueueSpy.mockRejectedValueOnce(new Error("redis down"));

    const state = await startAttemptState(cookies, lesson.id);
    expect(state.attemptId).toEqual(expect.any(String));
  });

  it("saves valid drafts only for the open attempt and before the deadline", async () => {
    const { cookies, lesson, questions } = await setupQuiz(10);
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    const draft = draftWithFirstCorrect(questions);

    const saved = await saveDraft(cookies, lesson.id, attemptId, draft).expect(200);
    expect(saved.body.data.draftSavedAt).toEqual(expect.any(String));
    expect((await startAttemptState(cookies, lesson.id)).draftAnswers).toEqual(draft);

    const wrongAttempt = await saveDraft(cookies, lesson.id, lesson.id, draft).expect(409);
    expect(wrongAttempt.body.message).toBe("studentLessonView.validation.quizAttemptNotStarted");

    const invalid = await saveDraft(cookies, lesson.id, attemptId, [
      { questionId: questions[0].questionId, answers: [{ answerId: questions[1].correctId }] },
    ]).expect(400);
    expect(invalid.body.message).toBe("studentLessonView.validation.quizDraftInvalid");

    await expireAttempt(attemptId, 1);
    const late = await saveDraft(cookies, lesson.id, attemptId, draft).expect(409);
    expect(late.body.message).toBe("studentLessonView.validation.quizAttemptExpired");
  });

  it("rejects a timed submit without a started attempt", async () => {
    const { cookies, lesson, allCorrect } = await setupQuiz(10);

    const response = await submit(cookies, lesson.id, allCorrect).expect(409);
    expect(response.body.message).toBe("studentLessonView.validation.quizAttemptNotStarted");
  });

  it("accepts the sent answers within the grace period", async () => {
    const { student, cookies, lesson, assessment, allCorrect } = await setupQuiz(10);
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    await expireAttempt(attemptId, ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS - 10);

    const response = await submit(cookies, lesson.id, allCorrect).expect(201);
    expect(response.body.data.data.score).toBe(100);

    const attempts = await getAttempts(assessment.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      id: attemptId,
      attemptNumber: 1,
      submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED,
      scorePercentage: "100.00",
    });
    expect(attempts[0].submittedAt).not.toBeNull();
    expect((await getProgress(student.id, lesson.id)).completedAt).not.toBeNull();

    const again = await submit(cookies, lesson.id, allCorrect).expect(409);
    expect(again.body.message).toBe("studentLessonView.validation.quizAlreadyAnswered");
  });

  it("grades a partial in-time submit with unanswered questions as 0 points", async () => {
    const { cookies, lesson, allCorrect } = await setupQuiz(10);
    await startAttemptState(cookies, lesson.id);

    const response = await submit(cookies, lesson.id, allCorrect.slice(0, 1)).expect(201);
    expect(response.body.data.data).toMatchObject({
      score: 50,
      correctAnswerCount: 1,
      wrongAnswerCount: 1,
      questionCount: 2,
    });
  });

  it("ignores late submitted answers and grades the saved draft", async () => {
    const { cookies, lesson, assessment, questions, allCorrect } = await setupQuiz(10);
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    await saveDraft(cookies, lesson.id, attemptId, draftWithFirstCorrect(questions)).expect(200);
    await expireAttempt(attemptId, pastGrace);

    const response = await submit(cookies, lesson.id, allCorrect).expect(201);
    expect(response.body.data.data.score).toBe(50);

    const [attempt] = await getAttempts(assessment.id);
    expect(attempt.submissionStatus).toBe(ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED);
    const answers = await db
      .select()
      .from(assessmentAttemptQuestionAnswers)
      .where(eq(assessmentAttemptQuestionAnswers.attemptId, attemptId));
    expect(answers).toHaveLength(2);

    const resubmit = await submit(cookies, lesson.id, allCorrect).expect(409);
    expect(resubmit.body.message).toBe("studentLessonView.validation.quizAttemptExpired");
  });

  const addReviewedOpenQuestion = async (assessmentId: UUIDType) => {
    const [question] = await db
      .insert(assessmentQuestions)
      .values({
        assessmentId,
        questionType: ASSESSMENT_QUESTION_TYPES.BRIEF_RESPONSE,
        gradingMode: ASSESSMENT_GRADING_MODES.MANUAL,
        maximumPoints: "1",
        prompt: buildJsonbField("en", "Explain"),
        title: buildJsonbField("en", "Explain"),
        displayOrder: 3,
      })
      .returning();

    return question.id;
  };

  it("leaves an in-time submit with a reviewed open answer awaiting review", async () => {
    const { student, cookies, lesson, assessment, allCorrect } = await setupQuiz(10);
    const openQuestionId = await addReviewedOpenQuestion(assessment.id);
    const { attemptId } = await startAttemptState(cookies, lesson.id);

    const response = await submit(cookies, lesson.id, [
      ...allCorrect,
      { questionId: openQuestionId, answers: [{ value: "My open answer" }] },
    ]).expect(201);

    expect(response.body.data.data).toMatchObject({ awaitingReview: true });

    const [attempt] = await getAttempts(assessment.id);

    expect(attempt).toMatchObject({
      id: attemptId,
      submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED,
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.PENDING,
      result: ASSESSMENT_ATTEMPT_RESULTS.PENDING,
      scorePercentage: null,
      gradedAt: null,
    });
    expect((await getProgress(student.id, lesson.id)).completedAt).toBeNull();

    const restart = await startAttempt(cookies, lesson.id).expect(409);

    expect(restart.body.message).toBe("studentLessonView.validation.quizAwaitingReview");
  });

  it("grades an abandoned attempt whose draft skipped the reviewed open question", async () => {
    const { cookies, lesson, assessment, questions } = await setupQuiz(10);

    await addReviewedOpenQuestion(assessment.id);
    const { attemptId } = await startAttemptState(cookies, lesson.id);

    await saveDraft(cookies, lesson.id, attemptId, draftWithFirstCorrect(questions)).expect(200);
    await expireAttempt(attemptId, pastGrace);

    await startAttempt(cookies, lesson.id).expect(201);

    const [attempt] = await getAttempts(assessment.id);

    expect(attempt).toMatchObject({
      id: attemptId,
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      result: ASSESSMENT_ATTEMPT_RESULTS.FAILED,
      scorePercentage: "33.33",
    });
  });

  it("finalizes an expired attempt on a late start and reports it as finalized", async () => {
    const { cookies, lesson, assessment } = await setupQuiz(10);
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    await expireAttempt(attemptId, pastGrace);

    const response = await startAttempt(cookies, lesson.id).expect(201);
    expect(response.body.data).toEqual({
      status: QUIZ_ATTEMPT_START_STATUSES.FINALIZED,
      attempt: null,
    });

    const [attempt] = await getAttempts(assessment.id);
    expect(attempt).toMatchObject({
      id: attemptId,
      submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED,
    });
  });

  it("finalizes an abandoned attempt once and counts it as an attempt", async () => {
    const { student, cookies, lesson, assessment, questions } = await setupQuiz(10);
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    await saveDraft(cookies, lesson.id, attemptId, draftWithFirstCorrect(questions)).expect(200);

    const lessonService = app.get(LessonService);
    await expect(
      lessonService.finalizeExpiredQuizAttempt(attemptId, actorFor(student)),
    ).resolves.toEqual({ status: "not_expired", msUntilGraceEnds: expect.any(Number) });

    await expireAttempt(attemptId, pastGrace);
    await expect(
      lessonService.finalizeExpiredQuizAttempt(attemptId, actorFor(student)),
    ).resolves.toEqual({ status: "closed" });
    await expect(
      lessonService.finalizeExpiredQuizAttempt(attemptId, actorFor(student)),
    ).resolves.toEqual({ status: "closed" });

    const [attempt] = await getAttempts(assessment.id);
    expect(attempt).toMatchObject({
      submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED,
      scorePercentage: "50.00",
    });
    const progress = await getProgress(student.id, lesson.id);
    expect(progress.completedAt).not.toBeNull();
    expect(progress.quizScore).toBe(50);

    const blocked = await startAttempt(cookies, lesson.id).expect(409);
    expect(blocked.body.message).toBe("studentLessonView.validation.quizAlreadyAnswered");

    await request(app.getHttpServer())
      .delete("/api/lesson/delete-student-quiz-answers")
      .query({ lessonId: lesson.id })
      .set("Cookie", cookies)
      .expect(200);

    const retake = await startAttemptState(cookies, lesson.id);
    const attempts = await getAttempts(assessment.id);
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toMatchObject({ id: retake.attemptId, attemptNumber: 2 });
  });

  it("blocks the retake of an abandoned attempt under the attempt limit and cooldown", async () => {
    const { student, cookies, lesson } = await setupQuiz(10);
    await db
      .update(lessons)
      .set({ attemptsLimit: 1, quizCooldownInHours: 24 })
      .where(eq(lessons.id, lesson.id));
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    await expireAttempt(attemptId, pastGrace);
    await app.get(LessonService).finalizeExpiredQuizAttempt(attemptId, actorFor(student));

    const retake = await request(app.getHttpServer())
      .delete("/api/lesson/delete-student-quiz-answers")
      .query({ lessonId: lesson.id })
      .set("Cookie", cookies)
      .expect(409);
    expect(retake.body.message).toBe("studentLessonView.validation.quizRetakeUnavailable");
  });

  it("cancels an expired attempt whose learner lost access", async () => {
    const { student, cookies, lesson, assessment } = await setupQuiz(10);
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    await expireAttempt(attemptId, pastGrace);
    await db.delete(studentCourses).where(eq(studentCourses.studentId, student.id));

    await expect(
      app.get(LessonService).finalizeExpiredQuizAttempt(attemptId, actorFor(student)),
    ).resolves.toEqual({ status: "closed" });

    const [attempt] = await getAttempts(assessment.id);
    expect(attempt.submissionStatus).toBe(ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.CANCELLED);
    expect((await getProgress(student.id, lesson.id))?.completedAt ?? null).toBeNull();
  });

  it("finalizes a stale draft whose question was deleted", async () => {
    const { student, cookies, lesson, assessment, questions } = await setupQuiz(10);
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    await saveDraft(
      cookies,
      lesson.id,
      attemptId,
      questions.map(({ questionId, correctId }) => ({
        questionId,
        answers: [{ answerId: correctId }],
      })),
    ).expect(200);
    await db.delete(assessmentQuestions).where(eq(assessmentQuestions.id, questions[1].questionId));
    await expireAttempt(attemptId, pastGrace);

    await expect(
      app.get(LessonService).finalizeExpiredQuizAttempt(attemptId, actorFor(student)),
    ).resolves.toEqual({ status: "closed" });

    const [attempt] = await getAttempts(assessment.id);
    expect(attempt).toMatchObject({
      submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED,
      scorePercentage: "100.00",
    });
    await getLessonView(cookies, lesson.id).expect(200);
  });

  it("lazily finalizes an expired attempt when the learner opens the lesson", async () => {
    const { cookies, lesson, assessment, questions } = await setupQuiz(10);
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    await saveDraft(cookies, lesson.id, attemptId, draftWithFirstCorrect(questions)).expect(200);
    await expireAttempt(attemptId, pastGrace);

    const lessonView = await getLessonView(cookies, lesson.id).expect(200);

    expect(lessonView.body.data.lessonCompleted).toBe(true);
    expect(lessonView.body.data.quizAttempt).toBeNull();
    expect(lessonView.body.data.quizDetails.score).toBe(50);

    const [attempt] = await getAttempts(assessment.id);
    expect(attempt.submissionStatus).toBe(ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED);
  });

  it("serves the lesson when the worker and the lesson view finalize concurrently", async () => {
    const { student, cookies, lesson, assessment } = await setupQuiz(10);
    const { attemptId } = await startAttemptState(cookies, lesson.id);
    await expireAttempt(attemptId, pastGrace);

    const [, lessonView] = await Promise.all([
      app.get(LessonService).finalizeExpiredQuizAttempt(attemptId, actorFor(student)),
      getLessonView(cookies, lesson.id),
    ]);

    expect(lessonView.status).toBe(200);
    expect(lessonView.body.data.quizAttempt).toBeNull();
    const attempts = await getAttempts(assessment.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].submissionStatus).toBe(ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED);
  });

  it("keeps an open attempt out of statistics and feedback", async () => {
    const { student, cookies, lesson, assessment } = await setupQuiz(10);
    await startAttemptState(cookies, lesson.id);

    const stats = await app.get(StatisticsRepository).getQuizStats(student.id);
    expect(stats.totalAttempts).toBe(0);
    await expect(
      app.get(QuizAttemptService).findLatestAttemptFeedback(assessment.id, student.id),
    ).resolves.toBeNull();
  });
});
