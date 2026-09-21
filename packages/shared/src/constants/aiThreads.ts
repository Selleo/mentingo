export const AI_THREAD_STATUSES = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

export type AiThreadStatus = (typeof AI_THREAD_STATUSES)[keyof typeof AI_THREAD_STATUSES];

export const AI_THREAD_TYPES = {
  PRACTICE: "practice",
  AI_MENTOR: "ai-mentor",
} as const;

export type AiThreadType = (typeof AI_THREAD_TYPES)[keyof typeof AI_THREAD_TYPES];
