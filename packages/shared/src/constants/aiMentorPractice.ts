export const AI_MENTOR_PRACTICE_STATUSES = {
  QUEUED: "queued",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
} as const;

export type AiMentorPracticeStatus =
  (typeof AI_MENTOR_PRACTICE_STATUSES)[keyof typeof AI_MENTOR_PRACTICE_STATUSES];
