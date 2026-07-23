export const AI_JUDGE_MAX_CRITERION_SCORE = 5;

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
  AWAITING_REVISION: "awaiting_revision",
  COMPLETED: "completed",
  REQUIRES_REVIEW: "requires_review",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type AiJudgeGenerationStatus =
  (typeof AI_JUDGE_GENERATION_STATUS)[keyof typeof AI_JUDGE_GENERATION_STATUS];

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

export type AiJudgeDraftChangeType =
  (typeof AI_JUDGE_DRAFT_CHANGE_TYPE)[keyof typeof AI_JUDGE_DRAFT_CHANGE_TYPE];

export const AI_JUDGE_DRAFT_CHANGE_FIELD = {
  TASK_GOAL: "taskGoal",
  PASSING_THRESHOLD_PERCENT: "passingThresholdPercent",
  CRITERION: "criterion",
  TITLE: "title",
  EXPECTED_BEHAVIOR: "expectedBehavior",
  MAX_SCORE: "maxScore",
  SCORE_GUIDANCE: "scoreGuidance",
  DESCRIPTION: "description",
  EXAMPLE: "example",
  BLOCKING_ERROR: "blockingError",
} as const;

export type AiJudgeDraftChangeField =
  (typeof AI_JUDGE_DRAFT_CHANGE_FIELD)[keyof typeof AI_JUDGE_DRAFT_CHANGE_FIELD];

export const AI_JUDGE_GENERATION_MAX_ATTEMPTS = 3;

export const AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS = {
  PROGRESS: "ai-judge-configuration-generation:progress",
} as const;

export type AiJudgeConfigurationGenerationSocketEvent =
  (typeof AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS)[keyof typeof AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS];
