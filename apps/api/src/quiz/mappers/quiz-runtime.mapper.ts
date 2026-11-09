import {
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS,
} from "@repo/shared";
import { match } from "ts-pattern";

import type { QuizAuthoringLocalizedQuestion } from "../types/quiz-authoring.types";
import type {
  PreparedQuizAttempt,
  QuizOpenAttempt,
  QuizRuntimeSubmissionResult,
} from "../types/quiz-runtime.types";
import type { UUIDType } from "src/common";
import type { QuizAttemptState } from "src/lesson/lesson.schema";

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
  const { correctAnswerCount } = attemptData;
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

const toIsoString = (value: string) => new Date(value).toISOString();

export const mapQuizOpenAttemptToState = (attempt: QuizOpenAttempt): QuizAttemptState => ({
  attemptId: attempt.id,
  startedAt: toIsoString(attempt.startedAt),
  expiresAt: toIsoString(attempt.expiresAt),
  serverNow: toIsoString(attempt.serverNow),
  submitGraceSeconds: ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS,
  draftAnswers: attempt.draftAnswers ?? [],
  draftSavedAt: attempt.draftSavedAt ? toIsoString(attempt.draftSavedAt) : null,
});

/** Compares on the database clock, which also produced `expiresAt`. */
export const getQuizOpenAttemptTiming = (attempt: QuizOpenAttempt) => {
  const now = new Date(attempt.serverNow).getTime();
  const expiresAt = new Date(attempt.expiresAt).getTime();

  return {
    isExpired: now > expiresAt,
    isPastGrace: now > expiresAt + ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS * 1000,
    msUntilGraceEnds: Math.max(
      expiresAt + ASSESSMENT_TIMED_ATTEMPT_SUBMIT_GRACE_SECONDS * 1000 - now,
      0,
    ),
  };
};
