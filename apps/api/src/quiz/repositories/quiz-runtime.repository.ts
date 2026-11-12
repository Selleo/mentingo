import { Inject, Injectable } from "@nestjs/common";
import { ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES } from "@repo/shared";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { courseLearningContext } from "src/course-repetition/course-learning-context";
import { activeLearningState } from "src/course-repetition/course-learning-state.sql";
import { DB } from "src/storage/db/db.providers";
import {
  assessmentAttempts,
  assessmentAttemptBlankAnswers,
  assessmentAttemptChoiceSelections,
  assessmentAttemptMatchingAnswers,
  assessmentAttemptOpenTextAnswers,
  assessmentAttemptQuestionAnswerReviews,
  assessmentAttemptQuestionAnswers,
  assessmentAttemptScaleSelections,
  assessmentAttemptStatementAnswers,
  assessments,
} from "src/storage/schema";

import type {
  QuizAttemptDraftAnswers,
  QuizAttemptFinalizeUpdate,
  QuizAttemptInsert,
  QuizAttemptQuestionAnswerInsert,
  QuizAttemptChoiceSelectionInsert,
  QuizAttemptStatementAnswerInsert,
  QuizAttemptBlankAnswerInsert,
  QuizAttemptOpenTextAnswerInsert,
  QuizAttemptScaleSelectionInsert,
  QuizAttemptMatchingAnswerInsert,
} from "./quiz-runtime.repository.types";

@Injectable()
export class QuizRuntimeRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  withTransaction<T>(work: (trx: DatabasePg) => Promise<T>, db: DatabasePg = this.db): Promise<T> {
    return db === this.db ? this.db.transaction(work) : work(db);
  }

  async insertAttempt(values: QuizAttemptInsert, db: DatabasePg) {
    const [attempt] = await db
      .insert(assessmentAttempts)
      .values({
        ...values,
        learningStateId: courseLearningContext.getStore()?.learningStateId ?? null,
      })
      .returning({ id: assessmentAttempts.id });
    return attempt;
  }

  async finalizeOpenAttempt(
    attemptId: UUIDType,
    values: QuizAttemptFinalizeUpdate,
    db: DatabasePg,
  ) {
    const [attempt] = await db
      .update(assessmentAttempts)
      .set({ ...values, submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED })
      .where(
        and(
          eq(assessmentAttempts.id, attemptId),
          eq(
            assessmentAttempts.submissionStatus,
            ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.IN_PROGRESS,
          ),
        ),
      )
      .returning({ id: assessmentAttempts.id, attemptNumber: assessmentAttempts.attemptNumber });

    return attempt ?? null;
  }

  async saveDraftAnswers(
    attemptId: UUIDType,
    learnerId: UUIDType,
    draftAnswers: QuizAttemptDraftAnswers,
    db: DatabasePg = this.db,
  ) {
    const [attempt] = await db
      .update(assessmentAttempts)
      .set({
        draftAnswers: sql`${JSON.stringify(draftAnswers)}::text::jsonb`,
        draftSavedAt: sql`now()`,
      })
      .where(
        and(
          eq(assessmentAttempts.id, attemptId),
          eq(assessmentAttempts.learnerId, learnerId),
          eq(
            assessmentAttempts.submissionStatus,
            ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.IN_PROGRESS,
          ),
          gte(assessmentAttempts.expiresAt, sql`now()`),
        ),
      )
      .returning({ draftSavedAt: assessmentAttempts.draftSavedAt });

    return attempt ?? null;
  }

  async findOpenAttemptByLesson(lessonId: UUIDType, learnerId: UUIDType, db: DatabasePg = this.db) {
    const [attempt] = await db
      .select(this.openAttemptColumns())
      .from(assessmentAttempts)
      .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
      .where(
        and(
          eq(assessments.lessonId, lessonId),
          eq(assessmentAttempts.learnerId, learnerId),
          eq(
            assessmentAttempts.submissionStatus,
            ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.IN_PROGRESS,
          ),
          activeLearningState(assessmentAttempts.learningStateId),
        ),
      )
      .orderBy(desc(assessmentAttempts.attemptNumber))
      .limit(1);

    return attempt ?? null;
  }

  async findOpenAttemptById(attemptId: UUIDType, db: DatabasePg = this.db) {
    const [attempt] = await db
      .select(this.openAttemptColumns())
      .from(assessmentAttempts)
      .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
      .where(
        and(
          eq(assessmentAttempts.id, attemptId),
          eq(
            assessmentAttempts.submissionStatus,
            ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.IN_PROGRESS,
          ),
        ),
      )
      .limit(1);

    return attempt ?? null;
  }

  async cancelOpenAttempt(attemptId: UUIDType, db: DatabasePg = this.db) {
    const [attempt] = await db
      .update(assessmentAttempts)
      .set({ submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.CANCELLED })
      .where(
        and(
          eq(assessmentAttempts.id, attemptId),
          eq(
            assessmentAttempts.submissionStatus,
            ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.IN_PROGRESS,
          ),
        ),
      )
      .returning({ id: assessmentAttempts.id });

    return attempt ?? null;
  }

  async findLatestAttemptByLesson(
    lessonId: UUIDType,
    learnerId: UUIDType,
    db: DatabasePg = this.db,
  ) {
    const [attempt] = await db
      .select({
        submissionStatus: assessmentAttempts.submissionStatus,
        expiresAt: assessmentAttempts.expiresAt,
        submittedAt: assessmentAttempts.submittedAt,
      })
      .from(assessmentAttempts)
      .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
      .where(
        and(
          eq(assessments.lessonId, lessonId),
          eq(assessmentAttempts.learnerId, learnerId),
          activeLearningState(assessmentAttempts.learningStateId),
        ),
      )
      .orderBy(desc(assessmentAttempts.attemptNumber))
      .limit(1);

    return attempt ?? null;
  }

  async findAssessmentTimeLimit(lessonId: UUIDType, db: DatabasePg = this.db) {
    const [assessment] = await db
      .select({ id: assessments.id, timeLimitMinutes: assessments.timeLimitMinutes })
      .from(assessments)
      .where(eq(assessments.lessonId, lessonId))
      .limit(1);

    return assessment ?? null;
  }

  private openAttemptColumns() {
    return {
      id: assessmentAttempts.id,
      lessonId: assessments.lessonId,
      learnerId: assessmentAttempts.learnerId,
      learningStateId: assessmentAttempts.learningStateId,
      language: assessmentAttempts.language,
      attemptNumber: assessmentAttempts.attemptNumber,
      startedAt: assessmentAttempts.startedAt,
      // assessment_attempts_in_progress_expires_check guarantees a value for open attempts.
      expiresAt: sql<string>`${assessmentAttempts.expiresAt}`,
      draftAnswers: assessmentAttempts.draftAnswers,
      draftSavedAt: assessmentAttempts.draftSavedAt,
      serverNow: sql<string>`now()`,
    };
  }

  async insertQuestionAnswers(values: QuizAttemptQuestionAnswerInsert[], db: DatabasePg) {
    if (!values.length) return;
    await db.insert(assessmentAttemptQuestionAnswers).values(values);
  }

  async insertChoiceSelections(values: QuizAttemptChoiceSelectionInsert[], db: DatabasePg) {
    if (!values.length) return;
    await db.insert(assessmentAttemptChoiceSelections).values(values);
  }

  async insertStatementAnswers(values: QuizAttemptStatementAnswerInsert[], db: DatabasePg) {
    if (!values.length) return;
    await db.insert(assessmentAttemptStatementAnswers).values(values);
  }

  async insertBlankAnswers(values: QuizAttemptBlankAnswerInsert[], db: DatabasePg) {
    if (!values.length) return;
    await db.insert(assessmentAttemptBlankAnswers).values(values);
  }

  async insertOpenTextAnswers(values: QuizAttemptOpenTextAnswerInsert[], db: DatabasePg) {
    if (!values.length) return;
    await db.insert(assessmentAttemptOpenTextAnswers).values(values);
  }

  async insertScaleSelections(values: QuizAttemptScaleSelectionInsert[], db: DatabasePg) {
    if (!values.length) return;
    await db.insert(assessmentAttemptScaleSelections).values(values);
  }

  async insertMatchingAnswers(values: QuizAttemptMatchingAnswerInsert[], db: DatabasePg) {
    if (!values.length) return;
    await db.insert(assessmentAttemptMatchingAnswers).values(values);
  }

  async findLatestAttempt(
    assessmentId: UUIDType,
    learnerId: UUIDType,
    db: DatabasePg = this.db,
    submittedOnly = false,
  ) {
    const [attempt] = await db
      .select({
        id: assessmentAttempts.id,
        scorePercentage: assessmentAttempts.scorePercentage,
        gradingStatus: assessmentAttempts.gradingStatus,
        attemptNumber: assessmentAttempts.attemptNumber,
      })
      .from(assessmentAttempts)
      .where(
        and(
          eq(assessmentAttempts.assessmentId, assessmentId),
          and(
            eq(assessmentAttempts.learnerId, learnerId),
            activeLearningState(assessmentAttempts.learningStateId),
          ),
          submittedOnly
            ? eq(
                assessmentAttempts.submissionStatus,
                ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED,
              )
            : undefined,
        ),
      )
      .orderBy(desc(assessmentAttempts.attemptNumber))
      .limit(1);

    return attempt ?? null;
  }

  async findQuestionAnswers(attemptId: UUIDType, db: DatabasePg = this.db) {
    const questionAnswers = await db
      .select({
        id: assessmentAttemptQuestionAnswers.id,
        questionId: assessmentAttemptQuestionAnswers.questionId,
        awardedPoints: assessmentAttemptQuestionAnswers.awardedPoints,
        gradingStatus: assessmentAttemptQuestionAnswers.gradingStatus,
      })
      .from(assessmentAttemptQuestionAnswers)
      .where(eq(assessmentAttemptQuestionAnswers.attemptId, attemptId));

    return questionAnswers;
  }

  async findChoiceSelections(questionAnswerIds: UUIDType[], db: DatabasePg = this.db) {
    if (!questionAnswerIds.length) return [];
    return db
      .select()
      .from(assessmentAttemptChoiceSelections)
      .where(inArray(assessmentAttemptChoiceSelections.questionAnswerId, questionAnswerIds));
  }

  async findStatementAnswers(questionAnswerIds: UUIDType[], db: DatabasePg = this.db) {
    if (!questionAnswerIds.length) return [];
    return db
      .select()
      .from(assessmentAttemptStatementAnswers)
      .where(inArray(assessmentAttemptStatementAnswers.questionAnswerId, questionAnswerIds));
  }

  async findBlankAnswers(questionAnswerIds: UUIDType[], db: DatabasePg = this.db) {
    if (!questionAnswerIds.length) return [];
    return db
      .select()
      .from(assessmentAttemptBlankAnswers)
      .where(inArray(assessmentAttemptBlankAnswers.questionAnswerId, questionAnswerIds));
  }

  async findScaleSelections(questionAnswerIds: UUIDType[], db: DatabasePg = this.db) {
    if (!questionAnswerIds.length) return [];
    return db
      .select()
      .from(assessmentAttemptScaleSelections)
      .where(inArray(assessmentAttemptScaleSelections.questionAnswerId, questionAnswerIds));
  }

  async findOpenTextAnswers(questionAnswerIds: UUIDType[], db: DatabasePg = this.db) {
    if (!questionAnswerIds.length) return [];
    return db
      .select()
      .from(assessmentAttemptOpenTextAnswers)
      .where(inArray(assessmentAttemptOpenTextAnswers.questionAnswerId, questionAnswerIds));
  }

  async findLatestReviews(questionAnswerIds: UUIDType[], db: DatabasePg = this.db) {
    if (!questionAnswerIds.length) return [];

    return db
      .selectDistinctOn([assessmentAttemptQuestionAnswerReviews.questionAnswerId], {
        questionAnswerId: assessmentAttemptQuestionAnswerReviews.questionAnswerId,
        explanation: assessmentAttemptQuestionAnswerReviews.explanation,
      })
      .from(assessmentAttemptQuestionAnswerReviews)
      .where(inArray(assessmentAttemptQuestionAnswerReviews.questionAnswerId, questionAnswerIds))
      .orderBy(
        assessmentAttemptQuestionAnswerReviews.questionAnswerId,
        desc(assessmentAttemptQuestionAnswerReviews.revisionNumber),
      );
  }

  async findMatchingAnswers(questionAnswerIds: UUIDType[], db: DatabasePg = this.db) {
    if (!questionAnswerIds.length) return [];

    return db
      .select()
      .from(assessmentAttemptMatchingAnswers)
      .where(inArray(assessmentAttemptMatchingAnswers.questionAnswerId, questionAnswerIds));
  }
}
