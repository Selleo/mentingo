export const AI_JUDGE_GENERATION_MODE = {
  CREATE: "create",
  IMPROVE: "improve",
  REPAIR: "repair",
} as const;

export type AiJudgeGenerationMode =
  (typeof AI_JUDGE_GENERATION_MODE)[keyof typeof AI_JUDGE_GENERATION_MODE];

export const AI_JUDGE_GENERATION_STATUS = {
  DRAFTING: "drafting",
  EVALUATING: "evaluating",
  REVISING: "revising",
  COMPLETED: "completed",
  REQUIRES_REVIEW: "requires_review",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const AI_JUDGE_VALIDATION_SEVERITY = {
  ERROR: "error",
  WARNING: "warning",
} as const;

export const AI_JUDGE_VALIDATION_TARGET = {
  CONFIGURATION: "configuration",
  CRITERION: "criterion",
  SCORE_GUIDANCE: "scoreGuidance",
  BLOCKING_ERROR: "blockingError",
} as const;

export const AI_JUDGE_DRAFT_CHANGE_TYPE = {
  ADDED: "added",
  REMOVED: "removed",
  CHANGED: "changed",
} as const;

export const AI_JUDGE_GENERATION_MAX_ATTEMPTS = 3;

export const AI_JUDGE_CRITERION_REF_PATTERN = "^C[1-9][0-9]*$";
export const AI_JUDGE_BLOCKING_ERROR_REF_PATTERN = "^B[1-9][0-9]*$";
