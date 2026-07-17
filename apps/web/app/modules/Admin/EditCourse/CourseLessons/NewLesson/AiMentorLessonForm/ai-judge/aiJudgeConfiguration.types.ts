export type AiJudgeScoreGuidanceDraft = {
  id?: string;
  score: number;
  description: string;
  example: string | undefined;
};

export type AiJudgeCriterionDraft = {
  id?: string;
  title: string;
  expectedBehavior: string;
  maxScore: number;
  scoreGuidance: AiJudgeScoreGuidanceDraft[];
};

export type AiJudgeBlockingErrorDraft = {
  id?: string;
  description: string;
};

export type AiJudgeConfigurationDraft = {
  id?: string;
  taskGoal: string;
  passingThresholdPercent: number;
  criteria: AiJudgeCriterionDraft[];
  blockingErrors: AiJudgeBlockingErrorDraft[];
};

export const AI_JUDGE_GENERATION_STATUS = {
  DRAFTING: "drafting",
  EVALUATING: "evaluating",
  REVISING: "revising",
  COMPLETED: "completed",
  REQUIRES_REVIEW: "requires_review",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type AiJudgeGenerationStatus =
  (typeof AI_JUDGE_GENERATION_STATUS)[keyof typeof AI_JUDGE_GENERATION_STATUS];

export const AI_JUDGE_GENERATION_MODE = {
  CREATE: "create",
  IMPROVE: "improve",
} as const;

export type AiJudgeGenerationMode =
  (typeof AI_JUDGE_GENERATION_MODE)[keyof typeof AI_JUDGE_GENERATION_MODE];

export const AI_JUDGE_GENERATION_CHECK_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  PASSED: "passed",
  NEEDS_ATTENTION: "needs_attention",
} as const;

export type AiJudgeGenerationCheckStatus =
  (typeof AI_JUDGE_GENERATION_CHECK_STATUS)[keyof typeof AI_JUDGE_GENERATION_CHECK_STATUS];

export type AiJudgeGenerationCheck = {
  id: string;
  label: string;
  status: AiJudgeGenerationCheckStatus;
};

export type AiJudgeGenerationViewState = {
  status: AiJudgeGenerationStatus;
  attempt: number;
  maxAttempts: number;
  completedArtifacts: string[];
  evaluatorChecks: AiJudgeGenerationCheck[];
  currentCorrection?: string;
  remainingConcern?: string;
  draft?: AiJudgeConfigurationDraft;
  errorMessage?: string;
};

export type AiJudgeGenerationRequest = {
  mode: AiJudgeGenerationMode;
  instruction: string;
};
