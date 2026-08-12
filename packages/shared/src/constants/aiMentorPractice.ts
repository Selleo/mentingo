export const AI_MENTOR_PRACTICE_STATUSES = {
  QUEUED: "queued",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
} as const;

export type AiMentorPracticeStatus =
  (typeof AI_MENTOR_PRACTICE_STATUSES)[keyof typeof AI_MENTOR_PRACTICE_STATUSES];

export const AI_MENTOR_PRACTICE_ERROR_CODES = {
  GENERATION_FAILED: "generation_failed",
  QUEUE_FAILED: "queue_failed",
} as const;

export type AiMentorPracticeErrorCode =
  (typeof AI_MENTOR_PRACTICE_ERROR_CODES)[keyof typeof AI_MENTOR_PRACTICE_ERROR_CODES];
