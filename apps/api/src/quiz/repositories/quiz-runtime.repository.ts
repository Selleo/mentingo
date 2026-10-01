import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import {
  assessmentAttempts,
  assessmentAttemptBlankAnswers,
  assessmentAttemptChoiceSelections,
  assessmentAttemptOpenTextAnswers,
  assessmentAttemptQuestionAnswers,
  assessmentAttemptScaleSelections,
  assessmentAttemptStatementAnswers,
} from "src/storage/schema";

import type {
  QuizAttemptInsert,
  QuizAttemptQuestionAnswerInsert,
  QuizAttemptChoiceSelectionInsert,
  QuizAttemptStatementAnswerInsert,
  QuizAttemptBlankAnswerInsert,
  QuizAttemptOpenTextAnswerInsert,
  QuizAttemptScaleSelectionInsert,
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
      .values(values)
      .returning({ id: assessmentAttempts.id });
    return attempt;
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

  async findLatestAttempt(assessmentId: UUIDType, learnerId: UUIDType, db: DatabasePg = this.db) {
    const [attempt] = await db
      .select({
        id: assessmentAttempts.id,
        scorePercentage: assessmentAttempts.scorePercentage,
        attemptNumber: assessmentAttempts.attemptNumber,
      })
      .from(assessmentAttempts)
      .where(
        and(
          eq(assessmentAttempts.assessmentId, assessmentId),
          eq(assessmentAttempts.learnerId, learnerId),
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
}
