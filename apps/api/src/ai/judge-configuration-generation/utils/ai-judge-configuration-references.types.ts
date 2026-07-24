import type { ReferencedAiJudgeConfiguration } from "../schemas/ai-judge-configuration-generation.schema";
import type { UUIDType } from "src/common";

export type AiJudgeScoreGuidanceIdentity = {
  score: number;
  id?: UUIDType;
};

export type AiJudgeCriterionIdentity = {
  ref: string;
  id?: UUIDType;
  scoreGuidance: AiJudgeScoreGuidanceIdentity[];
};

export type AiJudgeBlockingErrorIdentity = {
  ref: string;
  id?: UUIDType;
};

export type AiJudgeConfigurationIdentityMap = {
  criteria: AiJudgeCriterionIdentity[];
  blockingErrors: AiJudgeBlockingErrorIdentity[];
};

export type ReferencedAiJudgeConfigurationContext = {
  configuration: ReferencedAiJudgeConfiguration;
  identities: AiJudgeConfigurationIdentityMap;
};
