import { Injectable } from "@nestjs/common";
import {
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES,
} from "@repo/shared";
import { sql } from "drizzle-orm";

import { QuizRuntimeRepository } from "../repositories/quiz-runtime.repository";

import type {
  PreparedQuizAttempt,
  QuizAttemptFeedback,
  QuizTimedAttemptStart,
} from "../types/quiz-runtime.types";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class QuizAttemptService {
  constructor(private readonly quizRuntimeRepository: QuizRuntimeRepository) {}

  async createSubmittedAttempt(attemptData: PreparedQuizAttempt, db?: DatabasePg) {
    return this.quizRuntimeRepository.withTransaction(async (trx) => {
      const latestAttempt = await this.quizRuntimeRepository.findLatestAttempt(
        attemptData.assessmentId,
        attemptData.learnerId,
        trx,
      );
      const attemptNumber = (latestAttempt?.attemptNumber ?? 0) + 1;
      const attempt = await this.quizRuntimeRepository.insertAttempt(
        {
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
        },
        trx,
      );

      await this.insertAnswers(attempt.id, attemptData, trx);

      return { attemptId: attempt.id, attemptNumber };
    }, db);
  }

  async startTimedAttempt(start: QuizTimedAttemptStart, db?: DatabasePg) {
    return this.quizRuntimeRepository.withTransaction(async (trx) => {
      const latestAttempt = await this.quizRuntimeRepository.findLatestAttempt(
        start.assessmentId,
        start.learnerId,
        trx,
      );
      const attempt = await this.quizRuntimeRepository.insertAttempt(
        {
          assessmentId: start.assessmentId,
          language: start.language,
          learnerId: start.learnerId,
          attemptNumber: (latestAttempt?.attemptNumber ?? 0) + 1,
          submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.IN_PROGRESS,
          gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.NOT_STARTED,
          result: ASSESSMENT_ATTEMPT_RESULTS.PENDING,
          availablePoints: start.availablePoints,
          expiresAt: sql`now() + make_interval(mins => ${start.timeLimitMinutes}::int)`,
        },
        trx,
      );

      return this.quizRuntimeRepository.findOpenAttemptById(attempt.id, trx);
    }, db);
  }

  /** Grades an open timed attempt in place; null when it was already finalized elsewhere. */
  async finalizeTimedAttempt(
    attemptId: UUIDType,
    attemptData: PreparedQuizAttempt,
    db?: DatabasePg,
  ) {
    return this.quizRuntimeRepository.withTransaction(async (trx) => {
      const attempt = await this.quizRuntimeRepository.finalizeOpenAttempt(
        attemptId,
        {
          gradingStatus: attemptData.gradingStatus,
          result: attemptData.result,
          availablePoints: attemptData.availablePoints,
          awardedPoints: attemptData.awardedPoints,
          scorePercentage: attemptData.scorePercentage,
          submittedAt: attemptData.submittedAt,
          gradedAt: attemptData.gradedAt,
        },
        trx,
      );

      if (!attempt) return null;

      await this.insertAnswers(attempt.id, attemptData, trx);

      return { attemptId: attempt.id, attemptNumber: attempt.attemptNumber };
    }, db);
  }

  private async insertAnswers(
    attemptId: UUIDType,
    attemptData: PreparedQuizAttempt,
    trx: DatabasePg,
  ) {
    await this.quizRuntimeRepository.insertQuestionAnswers(
      attemptData.questionAnswers.map((answer) => ({ ...answer, attemptId })),
      trx,
    );
    await this.quizRuntimeRepository.insertChoiceSelections(attemptData.choiceSelections, trx);
    await this.quizRuntimeRepository.insertStatementAnswers(attemptData.statementAnswers, trx);
    await this.quizRuntimeRepository.insertBlankAnswers(attemptData.blankAnswers, trx);
    await this.quizRuntimeRepository.insertOpenTextAnswers(attemptData.openTextAnswers, trx);
    await this.quizRuntimeRepository.insertScaleSelections(attemptData.scaleSelections, trx);
  }

  async findLatestAttemptFeedback(
    assessmentId: UUIDType,
    learnerId: UUIDType,
    db?: DatabasePg,
  ): Promise<QuizAttemptFeedback | null> {
    const attempt = await this.quizRuntimeRepository.findLatestAttempt(
      assessmentId,
      learnerId,
      db,
      true,
    );

    if (!attempt) return null;

    const questionAnswers = await this.quizRuntimeRepository.findQuestionAnswers(attempt.id, db);

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
        this.quizRuntimeRepository.findChoiceSelections(questionAnswerIds, db),
        this.quizRuntimeRepository.findStatementAnswers(questionAnswerIds, db),
        this.quizRuntimeRepository.findBlankAnswers(questionAnswerIds, db),
        this.quizRuntimeRepository.findScaleSelections(questionAnswerIds, db),
        this.quizRuntimeRepository.findOpenTextAnswers(questionAnswerIds, db),
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
