import { ASSESSMENT_ATTEMPT_RESULTS } from "@repo/shared";

import type { PreparedQuizAttempt, QuizRuntimeSubmissionResult } from "../types/quiz-runtime.types";
import type { UUIDType } from "src/common";

type PersistedQuizAttempt = {
  attemptId: UUIDType;
  attemptNumber: number;
};

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
