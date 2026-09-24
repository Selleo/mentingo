import { ASSESSMENT_ATTEMPT_RESULTS, ASSESSMENT_QUESTION_TYPES } from "@repo/shared";
import { match } from "ts-pattern";

import type { QuizAuthoringLocalizedQuestion } from "../types/quiz-authoring.types";
import type { PreparedQuizAttempt, QuizRuntimeSubmissionResult } from "../types/quiz-runtime.types";
import type { UUIDType } from "src/common";

type PersistedQuizAttempt = {
  attemptId: UUIDType;
  attemptNumber: number;
};

export const mapQuizQuestionDescriptionForDelivery = (question: QuizAuthoringLocalizedQuestion) =>
  match(question.questionType)
    .with(
      ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_TEXT,
      ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND,
      () => question.prompt,
    )
    .otherwise(() => question.description);

export const mapQuizAttemptToRuntimeSubmissionResult = (
  attemptData: PreparedQuizAttempt,
  persistedAttempt: PersistedQuizAttempt,
): QuizRuntimeSubmissionResult => {
  const correctAnswerCount = attemptData.questionAnswers.filter(
    (questionAnswer) => Number(questionAnswer.awardedPoints) > 0,
  ).length;
  const questionCount = attemptData.questionAnswers.length;

  return {
    correctAnswerCount,
    wrongAnswerCount: questionCount - correctAnswerCount,
    questionCount,
    score: Math.floor(Number(attemptData.scorePercentage)),
    passed: attemptData.result === ASSESSMENT_ATTEMPT_RESULTS.PASSED,
    ...persistedAttempt,
  };
};
