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
