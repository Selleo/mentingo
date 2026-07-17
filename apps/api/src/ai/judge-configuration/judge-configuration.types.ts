import type { MentorJudgeResponse } from "@japro/luma-sdk";
import type { SupportedLanguages } from "@repo/shared";

export const AI_JUDGE_CRITERION_STATUS = {
  NOT_MET: "not_met",
  PARTIAL: "partial",
  MET: "met",
} as const;

export type AiJudgeCriterionStatus =
  (typeof AI_JUDGE_CRITERION_STATUS)[keyof typeof AI_JUDGE_CRITERION_STATUS];

export type AiJudgeScoreGuidance = {
  score: number;
  description: string;
  example: string | null;
};

export type AiJudgeCriterion = {
  id: string;
  title: string;
  expectedBehavior: string;
  maxScore: number;
  scoreGuidance: AiJudgeScoreGuidance[];
};

export type AiJudgeBlockingError = {
  id: string;
  description: string;
};

export type AiJudgeRubric = {
  configurationId: string;
  taskGoal: string;
  passingThresholdPercent: number;
  criteria: AiJudgeCriterion[];
  blockingErrors: AiJudgeBlockingError[];
};

export type AiJudgeRubricContext = {
  lessonTitle: string;
  rubric: AiJudgeRubric | null;
};

export type AiJudgeModelRubric = Omit<
  AiJudgeRubric,
  "configurationId" | "criteria" | "blockingErrors"
> & {
  criteria: Array<Omit<AiJudgeCriterion, "id"> & { criterionRef: string }>;
  blockingErrors: Array<Omit<AiJudgeBlockingError, "id"> & { blockingErrorRef: string }>;
};

export type AiJudgeModelResult = MentorJudgeResponse;

export type EvaluatedAiJudgeCriterion = {
  criterionId: string;
  title: string;
  awardedScore: number;
  maxScore: number;
  status: AiJudgeCriterionStatus;
  learnerSafeFeedback: string;
};

export type EvaluatedAiJudgeBlockingError = {
  blockingErrorId: string;
  description: string;
  learnerSafeFeedback: string;
};

export type EvaluatedAiJudgeResult = {
  minScore: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  criteria: EvaluatedAiJudgeCriterion[];
  blockingErrors: EvaluatedAiJudgeBlockingError[];
};

export type AiJudgePublicResult = EvaluatedAiJudgeResult;

export type AiJudgeJudgementWrite = {
  threadId: string;
  configurationId: string;
  language: SupportedLanguages;
  earnedPoints: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
};

export type AiJudgeCriterionJudgementWrite = {
  judgementId: string;
  criterionId: string;
  criterionTitle: string;
  awardedPoints: number;
  maxScoreAtJudgement: number;
  status: AiJudgeCriterionStatus;
  learnerSafeFeedback: string;
};

export type AiJudgeBlockingErrorJudgementWrite = {
  judgementId: string;
  blockingErrorId: string;
  blockingErrorDescription: string;
  learnerSafeFeedback: string;
};
