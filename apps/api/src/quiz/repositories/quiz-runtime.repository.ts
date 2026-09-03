import { Inject, Injectable } from "@nestjs/common";
import { ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES } from "@repo/shared";
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

import type { PreparedQuizAttempt, QuizAttemptFeedback } from "../types/quiz-runtime.types";

@Injectable()
export class QuizRuntimeRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async createSubmittedAttempt(attemptData: PreparedQuizAttempt, db?: DatabasePg) {
    const database = db ?? this.db;
    const persistAttempt = async (trx: DatabasePg) => {
      const [latestAttempt] = await trx
        .select({ attemptNumber: assessmentAttempts.attemptNumber })
        .from(assessmentAttempts)
        .where(
          and(
            eq(assessmentAttempts.assessmentId, attemptData.assessmentId),
            eq(assessmentAttempts.learnerId, attemptData.learnerId),
          ),
        )
        .orderBy(desc(assessmentAttempts.attemptNumber))
        .limit(1);

      const attemptNumber = (latestAttempt?.attemptNumber ?? 0) + 1;

      const [attempt] = await trx
        .insert(assessmentAttempts)
        .values({
          assessmentId: attemptData.assessmentId,
          language: attemptData.language,
          learnerId: attemptData.learnerId,
          attemptNumber,
          submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED,
          gradingStatus: attemptData.gradingStatus,
          result: attemptData.result,
          availablePoints: attemptData.availablePoints,
          awardedPoints: attemptData.awardedPoints,
          scorePercentage: attemptData.scorePercentage,
          submittedAt: attemptData.submittedAt,
          gradedAt: attemptData.gradedAt,
        })
        .returning({ id: assessmentAttempts.id });

      await trx.insert(assessmentAttemptQuestionAnswers).values(
        attemptData.questionAnswers.map((answer) => ({
          ...answer,
          attemptId: attempt.id,
        })),
      );

      if (attemptData.choiceSelections.length)
        await trx.insert(assessmentAttemptChoiceSelections).values(attemptData.choiceSelections);
      if (attemptData.statementAnswers.length)
        await trx.insert(assessmentAttemptStatementAnswers).values(attemptData.statementAnswers);
      if (attemptData.blankAnswers.length)
        await trx.insert(assessmentAttemptBlankAnswers).values(attemptData.blankAnswers);
      if (attemptData.openTextAnswers.length)
        await trx.insert(assessmentAttemptOpenTextAnswers).values(attemptData.openTextAnswers);
      if (attemptData.scaleSelections.length)
        await trx.insert(assessmentAttemptScaleSelections).values(attemptData.scaleSelections);

      return { attemptId: attempt.id, attemptNumber };
    };

    return database === this.db ? database.transaction(persistAttempt) : persistAttempt(database);
  }

  async findLatestAttemptFeedback(
    assessmentId: UUIDType,
    learnerId: UUIDType,
    db: DatabasePg = this.db,
  ): Promise<QuizAttemptFeedback | null> {
    const [attempt] = await db
      .select({
        id: assessmentAttempts.id,
        scorePercentage: assessmentAttempts.scorePercentage,
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

    if (!attempt) return null;

    const questionAnswers = await db
      .select({
        id: assessmentAttemptQuestionAnswers.id,
        questionId: assessmentAttemptQuestionAnswers.questionId,
        awardedPoints: assessmentAttemptQuestionAnswers.awardedPoints,
      })
      .from(assessmentAttemptQuestionAnswers)
      .where(eq(assessmentAttemptQuestionAnswers.attemptId, attempt.id));

    const questionAnswerIds = questionAnswers.map(({ id }) => id);

    if (!questionAnswerIds.length) {
      return {
        attempt,
        questionAnswers,
        choiceSelections: [],
        statementAnswers: [],
        blankAnswers: [],
        scaleSelections: [],
        openTextAnswers: [],
      };
    }

    const [choiceSelections, statementAnswers, blankAnswers, scaleSelections, openTextAnswers] =
      await Promise.all([
        db
          .select()
          .from(assessmentAttemptChoiceSelections)
          .where(inArray(assessmentAttemptChoiceSelections.questionAnswerId, questionAnswerIds)),
        db
          .select()
          .from(assessmentAttemptStatementAnswers)
          .where(inArray(assessmentAttemptStatementAnswers.questionAnswerId, questionAnswerIds)),
        db
          .select()
          .from(assessmentAttemptBlankAnswers)
          .where(inArray(assessmentAttemptBlankAnswers.questionAnswerId, questionAnswerIds)),
        db
          .select()
          .from(assessmentAttemptScaleSelections)
          .where(inArray(assessmentAttemptScaleSelections.questionAnswerId, questionAnswerIds)),
        db
          .select()
          .from(assessmentAttemptOpenTextAnswers)
          .where(inArray(assessmentAttemptOpenTextAnswers.questionAnswerId, questionAnswerIds)),
      ]);

    return {
      attempt,
      questionAnswers,
      choiceSelections,
      statementAnswers,
      blankAnswers,
      scaleSelections,
      openTextAnswers,
    };
  }
}
