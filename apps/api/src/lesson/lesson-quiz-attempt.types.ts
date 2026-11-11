import type { QUIZ_ATTEMPT_FINALIZATION_STATUSES } from "./repositories/lesson.constants";
import type { LessonRepository } from "./repositories/lesson.repository";
import type { UUIDType } from "src/common";
import type { QuizTimedSubmissionOptions } from "src/quiz/types/quiz-runtime.types";

export type QuizSubmissionAccess = Awaited<
  ReturnType<LessonRepository["checkLessonAssignment"]>
>[number];

export type QuizEvaluationResult = {
  correctAnswerCount: number;
  wrongAnswerCount: number;
  questionCount: number;
  score: number;
  awaitingReview: boolean;
};

export type ExpiredQuizAttemptFinalization =
  | { status: typeof QUIZ_ATTEMPT_FINALIZATION_STATUSES.CLOSED }
  | { status: typeof QUIZ_ATTEMPT_FINALIZATION_STATUSES.NOT_EXPIRED; msUntilGraceEnds: number };

/** With `attemptId`, finalizes that open timed attempt instead of inserting a new one. */
export type LessonQuizSubmissionOptions = QuizTimedSubmissionOptions & { attemptId?: UUIDType };
