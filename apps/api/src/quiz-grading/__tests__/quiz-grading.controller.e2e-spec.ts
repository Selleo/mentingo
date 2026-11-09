import { randomUUID } from "crypto";

import {
  ASSESSMENT_ANSWER_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_QUESTION_TYPES,
  COURSE_ENROLLMENT,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { QuizAttemptGradedEvent, QuizCompletedEvent } from "src/events";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { QuizAuthoringService } from "src/quiz/services/quiz-authoring.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  assessmentAttemptQuestionAnswerReviews,
  assessmentAttempts,
  assessmentQuestionOpenTextSettings,
  studentCourses,
  studentLessonProgress,
  tenants,
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

describe("QuizGradingController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let defaultTenantId: UUIDType;
  let runAsTenant: <T>(tenantId: UUIDType, fn: () => Promise<T>) => Promise<T>;
  const password = "Password123!";

  beforeAll(async () => {
    const context = await createE2ETest({ useDbProxy: true });
    app = context.app;
    defaultTenantId = context.defaultTenantId;
    runAsTenant = context.runAsTenant;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, [
      "assessment_attempts",
      "assessment_questions",
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

  const createUser = async (roleSlug: SystemRoleSlug, tenantId = defaultTenantId) => {
    const user = await createUserFactory(db)
      .withCredentials({ password })
      .create({ roleSlug, tenantId });
    await createSettingsFactory(db, user.id).create();
    return user;
  };

  // A quiz with two reviewer-graded open questions; passing needs at least half of the points.
  const setup = () =>
    runAsTenant(defaultTenantId, async () => {
      await createSettingsFactory(db).create({ userId: null });
      const author = await createUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const student = await createUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const reviewer = await createUser(SYSTEM_ROLE_SLUGS.REVIEWER);
      const category = await createCategoryFactory(db).create();
      const course = await createCourseFactory(db).create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
        settings: { lessonSequenceEnabled: false, quizFeedbackEnabled: true },
      });
      const chapter = await createChapterFactory(db).create({ courseId: course.id });
      await db.insert(studentCourses).values({
        id: randomUUID(),
        studentId: student.id,
        courseId: course.id,
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: new Date().toISOString(),
      });

      const authoring = app.get(QuizAuthoringService);
      const lesson = await authoring.createQuizLesson({
        chapterId: chapter.id,
        title: "Open answers",
        type: LESSON_TYPES.QUIZ,
        thresholdScore: 50,
        displayOrder: 1,
        attemptsLimit: null,
        quizCooldownInHours: null,
        questions: [
          { type: ASSESSMENT_QUESTION_TYPES.BRIEF_RESPONSE, title: "Brief", requiresReview: true },
          {
            type: ASSESSMENT_QUESTION_TYPES.DETAILED_RESPONSE,
            title: "Detailed",
            requiresReview: true,
          },
        ],
      });
      const questions = (await authoring.getLegacyQuizLessonForAuthoring(lesson.id))?.questions;
      const [briefId, detailedId] = (questions ?? []).map(({ id }) => id as UUIDType);

      await db
        .update(assessmentQuestionOpenTextSettings)
        .set({ reviewerInstructions: "Look for two arguments" })
        .where(eq(assessmentQuestionOpenTextSettings.questionId, briefId));

      return {
        student,
        reviewer,
        course,
        lesson,
        briefId,
        detailedId,
        studentCookie: await cookieFor(student, app),
        reviewerCookie: await cookieFor(reviewer, app),
      };
    });

  const submitQuiz = async (
    cookie: string,
    lessonId: UUIDType,
    briefId: UUIDType,
    detailedId: UUIDType,
  ) =>
    request(app.getHttpServer())
      .post("/api/lesson/evaluation-quiz")
      .set("Cookie", cookie)
      .send({
        lessonId,
        language: "en",
        questionsAnswers: [
          { questionId: briefId, answers: [{ value: "Brief answer" }] },
          { questionId: detailedId, answers: [{ value: "Detailed answer" }] },
        ],
      })
      .expect(201);

  const listAnswers = (cookie: string, query = "") =>
    request(app.getHttpServer()).get(`/api/quiz-grading/answers${query}`).set("Cookie", cookie);

  const grade = (cookie: string, answerId: UUIDType, awardedPoints: number, comment?: string) =>
    request(app.getHttpServer())
      .post(`/api/quiz-grading/answers/${answerId}/grade`)
      .set("Cookie", cookie)
      .send({ awardedPoints, comment });

  const findProgress = async (studentId: UUIDType, lessonId: UUIDType) => {
    const [progress] = await dbAdmin
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

  const findAttempt = async (studentId: UUIDType) => {
    const [attempt] = await dbAdmin
      .select()
      .from(assessmentAttempts)
      .where(eq(assessmentAttempts.learnerId, studentId));
    return attempt;
  };

  it("lists pending answers oldest first with filters and shows the grading view", async () => {
    const t = await setup();
    await submitQuiz(t.studentCookie, t.lesson.id, t.briefId, t.detailedId);

    const list = await listAnswers(t.reviewerCookie, "?status=pending").expect(200);
    expect(list.body.pagination.totalItems).toBe(2);
    expect(
      list.body.data.map(({ questionTitle }: { questionTitle: string }) => questionTitle),
    ).toEqual(expect.arrayContaining(["Brief", "Detailed"]));
    expect(list.body.data[0]).toMatchObject({
      gradingStatus: ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING,
      awardedPoints: null,
      maximumPoints: 1,
      course: { id: t.course.id },
      lesson: { id: t.lesson.id, name: "Open answers" },
      student: { id: t.student.id },
    });

    const filtered = await listAnswers(
      t.reviewerCookie,
      `?status=pending&studentId=${t.reviewer.id}`,
    ).expect(200);
    expect(filtered.body.pagination.totalItems).toBe(0);

    const filters = await request(app.getHttpServer())
      .get("/api/quiz-grading/filters")
      .set("Cookie", t.reviewerCookie)
      .expect(200);
    expect(filters.body.data).toMatchObject({
      courses: [{ id: t.course.id }],
      lessons: [{ id: t.lesson.id, courseId: t.course.id }],
      students: [{ id: t.student.id }],
    });

    const briefAnswer = list.body.data.find(
      ({ questionTitle }: { questionTitle: string }) => questionTitle === "Brief",
    );
    const details = await request(app.getHttpServer())
      .get(`/api/quiz-grading/answers/${briefAnswer.id}`)
      .set("Cookie", t.reviewerCookie)
      .expect(200);
    expect(details.body.data).toMatchObject({
      studentAnswer: "Brief answer",
      reviewerInstructions: "Look for two arguments",
      attemptNumber: 1,
      reviews: [],
    });
    expect(details.body.data.nextAnswerId).not.toBe(briefAnswer.id);
    expect(details.body.data.nextAnswerId).toEqual(expect.any(String));
  });

  it("finalizes the attempt, completes the lesson and emits events when the last answer is graded", async () => {
    const t = await setup();
    await submitQuiz(t.studentCookie, t.lesson.id, t.briefId, t.detailedId);
    const [first, second] = (await listAnswers(t.reviewerCookie).expect(200)).body.data;
    const publishSpy = jest.spyOn(app.get(OutboxPublisher), "publish");

    const firstGrade = await grade(t.reviewerCookie, first.id, 1, "Good").expect(201);
    expect(firstGrade.body.data).toEqual({ attemptGraded: false, nextAnswerId: second.id });
    expect(await findAttempt(t.student.id)).toMatchObject({
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.PENDING,
    });

    const lastGrade = await grade(t.reviewerCookie, second.id, 0, "Missing arguments").expect(201);
    expect(lastGrade.body.data).toEqual({ attemptGraded: true, nextAnswerId: null });

    const events = publishSpy.mock.calls.map(([event]) => event);
    publishSpy.mockRestore();
    expect(events.some((event) => event instanceof QuizCompletedEvent)).toBe(true);
    expect(events.find((event) => event instanceof QuizAttemptGradedEvent)).toMatchObject({
      userId: t.student.id,
      reviewerId: t.reviewer.id,
      score: 50,
      passed: true,
      isRegrade: false,
    });

    expect(await findAttempt(t.student.id)).toMatchObject({
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
      result: ASSESSMENT_ATTEMPT_RESULTS.PASSED,
      awardedPoints: "1.00",
      scorePercentage: "50.00",
      gradedAt: expect.any(String),
    });
    expect(await findProgress(t.student.id, t.lesson.id)).toMatchObject({
      completedAt: expect.any(String),
      isQuizPassed: true,
      quizScore: 50,
    });

    const lessonView = await request(app.getHttpServer())
      .get(`/api/lesson/${t.lesson.id}?language=en`)
      .set("Cookie", t.studentCookie)
      .expect(200);
    expect(lessonView.body.data).toMatchObject({
      lessonCompleted: true,
      isQuizAwaitingReview: false,
      quizDetails: { score: 50 },
    });
    expect(
      lessonView.body.data.quizDetails.questions.map(
        ({ reviewerFeedback }: { reviewerFeedback: unknown }) => reviewerFeedback,
      ),
    ).toEqual(
      expect.arrayContaining([
        { awardedPoints: 1, maximumPoints: 1, comment: "Good" },
        { awardedPoints: 0, maximumPoints: 1, comment: "Missing arguments" },
      ]),
    );
  });

  it("keeps grading history and never reopens a completed lesson on re-grade", async () => {
    const t = await setup();
    await submitQuiz(t.studentCookie, t.lesson.id, t.briefId, t.detailedId);
    const [first, second] = (await listAnswers(t.reviewerCookie).expect(200)).body.data;
    await grade(t.reviewerCookie, first.id, 1).expect(201);
    await grade(t.reviewerCookie, second.id, 1).expect(201);

    await grade(t.reviewerCookie, first.id, 0, "Re-checked").expect(201);
    await grade(t.reviewerCookie, second.id, 0).expect(201);

    const reviews = await dbAdmin
      .select()
      .from(assessmentAttemptQuestionAnswerReviews)
      .where(eq(assessmentAttemptQuestionAnswerReviews.questionAnswerId, first.id));
    expect(reviews.map(({ revisionNumber }) => revisionNumber).sort()).toEqual([1, 2]);

    const details = await request(app.getHttpServer())
      .get(`/api/quiz-grading/answers/${first.id}`)
      .set("Cookie", t.reviewerCookie)
      .expect(200);
    expect(details.body.data).toMatchObject({
      gradingStatus: ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED,
      awardedPoints: 0,
      reviews: [
        { revisionNumber: 2, awardedPoints: 0, comment: "Re-checked" },
        { revisionNumber: 1, awardedPoints: 1, comment: "" },
      ],
    });

    expect(await findAttempt(t.student.id)).toMatchObject({
      result: ASSESSMENT_ATTEMPT_RESULTS.FAILED,
      scorePercentage: "0.00",
    });
    expect(await findProgress(t.student.id, t.lesson.id)).toMatchObject({
      completedAt: expect.any(String),
      isQuizPassed: true,
      quizScore: 0,
    });
  });

  it("rejects points above the question maximum", async () => {
    const t = await setup();
    await submitQuiz(t.studentCookie, t.lesson.id, t.briefId, t.detailedId);
    const [first] = (await listAnswers(t.reviewerCookie).expect(200)).body.data;

    const response = await grade(t.reviewerCookie, first.id, 2).expect(400);
    expect(response.body.message).toBe("quizGrading.errors.pointsOutOfRange");
    await grade(t.reviewerCookie, first.id, 0.5).expect(400);
  });

  it("requires quiz grading permissions", async () => {
    const t = await setup();
    await submitQuiz(t.studentCookie, t.lesson.id, t.briefId, t.detailedId);
    const [first] = (await listAnswers(t.reviewerCookie).expect(200)).body.data;

    await listAnswers(t.studentCookie).expect(403);
    await request(app.getHttpServer())
      .get(`/api/quiz-grading/answers/${first.id}`)
      .set("Cookie", t.studentCookie)
      .expect(403);
    await grade(t.studentCookie, first.id, 1).expect(403);
  });

  it("isolates the queue between tenants", async () => {
    const t = await setup();
    await submitQuiz(t.studentCookie, t.lesson.id, t.briefId, t.detailedId);
    const [first] = (await listAnswers(t.reviewerCookie).expect(200)).body.data;

    const [otherTenant] = await dbAdmin
      .insert(tenants)
      .values({ name: "Other grading tenant", host: `https://${randomUUID()}.example` })
      .returning();
    const otherReviewer = await runAsTenant(otherTenant.id, async () => {
      await createSettingsFactory(db).create({ userId: null });
      return createUser(SYSTEM_ROLE_SLUGS.REVIEWER, otherTenant.id);
    });
    const otherCookie = await cookieFor(otherReviewer, app, otherTenant.host);
    const asOtherTenant = (req: request.Test) =>
      req.set("Cookie", otherCookie).set("Referer", `${otherTenant.host}/`);

    const list = await asOtherTenant(
      request(app.getHttpServer()).get("/api/quiz-grading/answers"),
    ).expect(200);
    expect(list.body.pagination.totalItems).toBe(0);
    await asOtherTenant(
      request(app.getHttpServer()).get(`/api/quiz-grading/answers/${first.id}`),
    ).expect(404);
    await asOtherTenant(
      request(app.getHttpServer())
        .post(`/api/quiz-grading/answers/${first.id}/grade`)
        .send({ awardedPoints: 1 }),
    ).expect(404);

    expect(await findAttempt(t.student.id)).toMatchObject({
      gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.PENDING,
    });
  });
});
