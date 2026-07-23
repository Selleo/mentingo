import { AI_JUDGE_GENERATION_MODE, AI_JUDGE_GENERATION_STATUS } from "@repo/shared";

import type {
  AiJudgeDraftChangeField,
  AiJudgeDraftChangeType,
  AiJudgeGenerationStatus as SharedAiJudgeGenerationStatus,
} from "@repo/shared";
import type { ValidateConfigurationResponse } from "~/api/generated-api";

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

export { AI_JUDGE_GENERATION_MODE, AI_JUDGE_GENERATION_STATUS };

export type AiJudgeGenerationStatus = SharedAiJudgeGenerationStatus;
export type AiJudgeGenerationMode =
  | typeof AI_JUDGE_GENERATION_MODE.CREATE
  | typeof AI_JUDGE_GENERATION_MODE.IMPROVE;

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
  detail?: string;
  targetRef?: string;
  targetScore?: number;
  targetTypeLabel?: string;
  targetLabel?: string;
  status: AiJudgeGenerationCheckStatus;
};

export type AiJudgeGenerationChange = {
  type: AiJudgeDraftChangeType;
  targetRef: string;
  targetTypeLabel?: string;
  targetLabel?: string;
  score?: number;
  field: AiJudgeDraftChangeField;
  before?: string | number | null;
  after?: string | number | null;
};

export type AiJudgeGenerationAttempt = {
  attempt: number;
  passed: boolean;
  summary: string;
  corrections: string[];
  changes: AiJudgeGenerationChange[];
};

export type AiJudgeGenerationViewState = {
  status: AiJudgeGenerationStatus;
  attempt: number;
  maxAttempts: number;
  completedArtifacts: string[];
  evaluatorChecks: AiJudgeGenerationCheck[];
  changes: AiJudgeGenerationChange[];
  attemptHistory: AiJudgeGenerationAttempt[];
  currentCorrection?: string;
  remainingConcern?: string;
  draft?: AiJudgeConfigurationDraft;
};

export type AiJudgeGenerationRequest = {
  mode: AiJudgeGenerationMode;
  instruction: string;
};

export type AiJudgeValidationResult = ValidateConfigurationResponse["data"];
