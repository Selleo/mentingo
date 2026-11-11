export const MAX_LESSON_TITLE_LENGTH = 250;

export const QUIZ_ATTEMPT_EXPIRATION_JOB_NAME = "finalize-expired-quiz-attempt";

export const QUIZ_ATTEMPT_FINALIZATION_STATUSES = {
  /** The attempt is no longer open: finalized now, by a concurrent finalizer, or cancelled. */
  CLOSED: "closed",
  NOT_EXPIRED: "not_expired",
} as const;
