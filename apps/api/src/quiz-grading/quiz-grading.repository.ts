import { Inject, Injectable } from "@nestjs/common";
import {
  ASSESSMENT_ANSWER_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES,
  ASSESSMENT_GRADING_MODES,
} from "@repo/shared";
import { and, asc, count, desc, eq, max, ne, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { activeLearningState } from "src/course-repetition/course-learning-state.sql";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  assessmentAttemptOpenTextAnswers,
  assessmentAttemptQuestionAnswerReviews,
  assessmentAttemptQuestionAnswers,
  assessmentAttempts,
  assessmentQuestionOpenTextSettings,
  assessmentQuestions,
  assessments,
  chapters,
  courses,
  lessons,
  studentLessonProgress,
  users,
} from "src/storage/schema";

import type {
  QuizAnswerReviewInsert,
  QuizGradedAttemptUpdate,
  QuizGradingAnswerFilters,
} from "./quiz-grading.types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const fullName = sql<string>`concat_ws(' ', ${users.firstName}, ${users.lastName})`;

// Questions are localized by their assessment; reviewers read them in the student's language.
const localizedQuestionField = (column: AnyPgColumn) =>
  sql<string>`COALESCE(NULLIF(${column} ->> ${assessmentAttempts.language}, ''), ${column} ->> ${assessments.baseLanguage}, '')`;

@Injectable()
export class QuizGradingRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findAnswers(
    filters: QuizGradingAnswerFilters,
    reviewerId: UUIDType,
    page: number,
    perPage: number,
  ) {
    const queue = this.queueSubquery(filters, reviewerId);

    const [data, [{ totalItems }]] = await Promise.all([
      this.db
        .select(this.listFields(queue))
        .from(queue)
        .orderBy(asc(queue.submittedAt), asc(queue.id))
        .limit(perPage)
        .offset((page - 1) * perPage),
      this.db.select({ totalItems: count() }).from(queue),
    ]);

    return { data, totalItems };
  }

  async findFilterOptions(reviewerId: UUIDType) {
    const queue = this.queueSubquery({}, reviewerId);

    const [courseRows, lessonRows, studentRows] = await Promise.all([
      this.db
        .selectDistinct({ id: queue.courseId, name: queue.courseName })
        .from(queue)
        .orderBy(queue.courseName, queue.courseId),
      this.db
        .selectDistinct({ id: queue.lessonId, name: queue.lessonName, courseId: queue.courseId })
        .from(queue)
        .orderBy(queue.lessonName, queue.lessonId, queue.courseId),
      this.db
        .selectDistinct({ id: queue.studentId, name: queue.studentName })
        .from(queue)
        .orderBy(queue.studentName, queue.studentId),
    ]);

    return { courses: courseRows, lessons: lessonRows, students: studentRows };
  }

  async findAnswerDetails(answerId: UUIDType, reviewerId: UUIDType) {
    const queue = this.queueSubquery({}, reviewerId);

    const [answer] = await this.db
      .select({
        ...this.listFields(queue),
        questionDescription: queue.questionDescription,
        attemptNumber: queue.attemptNumber,
        reviewerInstructions: assessmentQuestionOpenTextSettings.reviewerInstructions,
        studentAnswer: sql<string>`COALESCE(${assessmentAttemptOpenTextAnswers.submittedText}, '')`,
      })
      .from(queue)
      .leftJoin(
        assessmentQuestionOpenTextSettings,
        eq(assessmentQuestionOpenTextSettings.questionId, queue.questionId),
      )
      .leftJoin(
        assessmentAttemptOpenTextAnswers,
        eq(assessmentAttemptOpenTextAnswers.questionAnswerId, queue.id),
      )
      .where(eq(queue.id, answerId));

    return answer ?? null;
  }

  async findReviews(answerId: UUIDType) {
    return this.db
      .select({
        id: assessmentAttemptQuestionAnswerReviews.id,
        revisionNumber: assessmentAttemptQuestionAnswerReviews.revisionNumber,
        reviewerName: fullName,
        awardedPoints: sql<number>`${assessmentAttemptQuestionAnswerReviews.awardedPoints}::float`,
        comment: assessmentAttemptQuestionAnswerReviews.explanation,
        reviewedAt: assessmentAttemptQuestionAnswerReviews.reviewedAt,
      })
      .from(assessmentAttemptQuestionAnswerReviews)
      .innerJoin(users, eq(users.id, assessmentAttemptQuestionAnswerReviews.reviewerId))
      .where(eq(assessmentAttemptQuestionAnswerReviews.questionAnswerId, answerId))
      .orderBy(desc(assessmentAttemptQuestionAnswerReviews.revisionNumber));
  }

  async findNextPendingAnswerId(
    excludedAnswerId: UUIDType,
    reviewerId: UUIDType,
    db: DatabasePg = this.db,
  ) {
    const queue = this.queueSubquery(
      { status: ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING },
      reviewerId,
      db,
    );

    const [next] = await db
      .select({ id: queue.id })
      .from(queue)
      .where(ne(queue.id, excludedAnswerId))
      .orderBy(asc(queue.submittedAt), asc(queue.id))
      .limit(1);

    return next?.id ?? null;
  }

  async findAnswerForGrading(answerId: UUIDType, db: DatabasePg) {
    const [answer] = await db
      .select({
        id: assessmentAttemptQuestionAnswers.id,
        maximumPoints: sql<number>`${assessmentQuestions.maximumPoints}::float`,
        gradingMode: assessmentQuestions.gradingMode,
        attemptId: assessmentAttempts.id,
        attemptNumber: assessmentAttempts.attemptNumber,
        attemptGradingStatus: assessmentAttempts.gradingStatus,
        availablePoints: sql<number>`${assessmentAttempts.availablePoints}::float`,
        learningStateId: assessmentAttempts.learningStateId,
        language: assessmentAttempts.language,
        studentId: assessmentAttempts.learnerId,
        assessmentId: assessments.id,
        passingScorePercentage: sql<number>`${assessments.passingScorePercentage}::float`,
        lessonId: lessons.id,
        chapterId: chapters.id,
        courseId: courses.id,
      })
      .from(assessmentAttemptQuestionAnswers)
      .innerJoin(
        assessmentQuestions,
        eq(assessmentQuestions.id, assessmentAttemptQuestionAnswers.questionId),
      )
      .innerJoin(
        assessmentAttempts,
        eq(assessmentAttempts.id, assessmentAttemptQuestionAnswers.attemptId),
      )
      .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
      .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(assessmentAttemptQuestionAnswers.id, answerId));

    return answer ?? null;
  }

  async insertReview(values: Omit<QuizAnswerReviewInsert, "revisionNumber">, db: DatabasePg) {
    const [{ latestRevision }] = await db
      .select({ latestRevision: max(assessmentAttemptQuestionAnswerReviews.revisionNumber) })
      .from(assessmentAttemptQuestionAnswerReviews)
      .where(eq(assessmentAttemptQuestionAnswerReviews.questionAnswerId, values.questionAnswerId));

    await db
      .insert(assessmentAttemptQuestionAnswerReviews)
      .values({ ...values, revisionNumber: (latestRevision ?? 0) + 1 });
  }

  async markAnswerGraded(answerId: UUIDType, awardedPoints: number, db: DatabasePg) {
    await db
      .update(assessmentAttemptQuestionAnswers)
      .set({
        gradingStatus: ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED,
        awardedPoints: awardedPoints.toString(),
      })
      .where(eq(assessmentAttemptQuestionAnswers.id, answerId));
  }

  async findAttemptAnswers(attemptId: UUIDType, db: DatabasePg) {
    return db
      .select({
        gradingStatus: assessmentAttemptQuestionAnswers.gradingStatus,
        awardedPoints: sql<number>`COALESCE(${assessmentAttemptQuestionAnswers.awardedPoints}, 0)::float`,
      })
      .from(assessmentAttemptQuestionAnswers)
      .where(eq(assessmentAttemptQuestionAnswers.attemptId, attemptId));
  }

  async updateGradedAttempt(attemptId: UUIDType, values: QuizGradedAttemptUpdate, db: DatabasePg) {
    await db.update(assessmentAttempts).set(values).where(eq(assessmentAttempts.id, attemptId));
  }

  async findLessonProgress(lessonId: UUIDType, studentId: UUIDType, db: DatabasePg) {
    const [progress] = await db
      .select({
        id: studentLessonProgress.id,
        completedAt: studentLessonProgress.completedAt,
        isQuizPassed: studentLessonProgress.isQuizPassed,
        completedQuestionCount: studentLessonProgress.completedQuestionCount,
      })
      .from(studentLessonProgress)
      .where(
        and(
          eq(studentLessonProgress.lessonId, lessonId),
          eq(studentLessonProgress.studentId, studentId),
          activeLearningState(studentLessonProgress.learningStateId),
        ),
      );

    return progress ?? null;
  }

  async updateLessonProgressScore(
    progressId: UUIDType,
    values: { quizScore: number; isQuizPassed: boolean },
    db: DatabasePg,
  ) {
    await db
      .update(studentLessonProgress)
      .set(values)
      .where(eq(studentLessonProgress.id, progressId));
  }

  private listFields(queue: ReturnType<QuizGradingRepository["queueSubquery"]>) {
    return {
      id: queue.id,
      gradingStatus: queue.gradingStatus,
      awardedPoints: queue.awardedPoints,
      maximumPoints: queue.maximumPoints,
      submittedAt: queue.submittedAt,
      questionTitle: queue.questionTitle,
      course: { id: queue.courseId, name: queue.courseName },
      lesson: { id: queue.lessonId, name: queue.lessonName },
      student: { id: queue.studentId, name: queue.studentName },
    };
  }

  // Reviewer-graded answers from the learner's current learning state, never the reviewer's own.
  private queueSubquery(
    filters: QuizGradingAnswerFilters,
    reviewerId: UUIDType,
    db: DatabasePg = this.db,
  ) {
    return db
      .select({
        id: assessmentAttemptQuestionAnswers.id,
        questionId: sql<UUIDType>`${assessmentQuestions.id}`.as("queue_question_id"),
        gradingStatus: assessmentAttemptQuestionAnswers.gradingStatus,
        awardedPoints: sql<
          number | null
        >`CASE WHEN ${assessmentAttemptQuestionAnswers.gradingStatus} = ${ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED} THEN ${assessmentAttemptQuestionAnswers.awardedPoints}::float END`.as(
          "awarded_points",
        ),
        maximumPoints: sql<number>`${assessmentQuestions.maximumPoints}::float`.as(
          "maximum_points",
        ),
        submittedAt: assessmentAttemptQuestionAnswers.submittedAt,
        questionTitle: localizedQuestionField(assessmentQuestions.title).as("question_title"),
        questionDescription: sql<
          string | null
        >`NULLIF(${localizedQuestionField(assessmentQuestions.description)}, '')`.as(
          "question_description",
        ),
        attemptNumber: assessmentAttempts.attemptNumber,
        courseId: sql<UUIDType>`${courses.id}`.as("course_id"),
        courseName: this.courseTitle().as("course_name"),
        lessonId: sql<UUIDType>`${lessons.id}`.as("lesson_id"),
        lessonName: this.lessonTitle().as("lesson_name"),
        studentId: sql<UUIDType>`${users.id}`.as("student_id"),
        studentName: fullName.as("student_name"),
      })
      .from(assessmentAttemptQuestionAnswers)
      .innerJoin(
        assessmentQuestions,
        eq(assessmentQuestions.id, assessmentAttemptQuestionAnswers.questionId),
      )
      .innerJoin(
        assessmentAttempts,
        eq(assessmentAttempts.id, assessmentAttemptQuestionAnswers.attemptId),
      )
      .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
      .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .innerJoin(users, eq(users.id, assessmentAttempts.learnerId))
      .where(
        and(
          eq(assessmentQuestions.gradingMode, ASSESSMENT_GRADING_MODES.MANUAL),
          eq(assessmentAttempts.submissionStatus, ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED),
          activeLearningState(assessmentAttempts.learningStateId),
          ne(users.id, reviewerId),
          filters.status
            ? eq(assessmentAttemptQuestionAnswers.gradingStatus, filters.status)
            : undefined,
          filters.courseId ? eq(courses.id, filters.courseId) : undefined,
          filters.lessonId ? eq(lessons.id, filters.lessonId) : undefined,
          filters.studentId ? eq(users.id, filters.studentId) : undefined,
        ),
      )
      .as("grading_queue");
  }

  private courseTitle() {
    return this.localizationService.getLocalizedSqlField(
      courses.title,
      sql`${assessmentAttempts.language}`,
    );
  }

  private lessonTitle() {
    return this.localizationService.getLocalizedSqlField(
      lessons.title,
      sql`${assessmentAttempts.language}`,
    );
  }
}
