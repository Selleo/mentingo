import { Injectable } from "@nestjs/common";
import { ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES } from "@repo/shared";

import { QuizRuntimeRepository } from "../repositories/quiz-runtime.repository";

import type { PreparedQuizAttempt, QuizAttemptFeedback } from "../types/quiz-runtime.types";
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

      await this.quizRuntimeRepository.insertQuestionAnswers(
        attemptData.questionAnswers.map((answer) => ({ ...answer, attemptId: attempt.id })),
        trx,
      );
      await this.quizRuntimeRepository.insertChoiceSelections(attemptData.choiceSelections, trx);
      await this.quizRuntimeRepository.insertStatementAnswers(attemptData.statementAnswers, trx);
      await this.quizRuntimeRepository.insertBlankAnswers(attemptData.blankAnswers, trx);
      await this.quizRuntimeRepository.insertOpenTextAnswers(attemptData.openTextAnswers, trx);
      await this.quizRuntimeRepository.insertScaleSelections(attemptData.scaleSelections, trx);

      return { attemptId: attempt.id, attemptNumber };
    }, db);
  }

  async findLatestAttemptFeedback(
    assessmentId: UUIDType,
    learnerId: UUIDType,
    db?: DatabasePg,
  ): Promise<QuizAttemptFeedback | null> {
    const attempt = await this.quizRuntimeRepository.findLatestAttempt(assessmentId, learnerId, db);

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
