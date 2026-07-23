import type { RunAiJudgeConfigurationGenerationInput } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation-workflow.types";
import type {
  AiJudgeGenerationAttempt,
  AiJudgeGenerationApplicationProgressEvent,
  AiJudgeGenerationApplicationResult,
  GenerateAiJudgeConfigurationInput,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationIdentityMap } from "src/ai/judge-configuration-generation/ai-judge-configuration-references.types";
import type { UUIDType } from "src/common";

export type AiJudgeGenerationExecutionOptions = {
  reportProgress?: (progress: AiJudgeGenerationApplicationProgressEvent) => Promise<void> | void;
  isCancelled?: () => Promise<boolean> | boolean;
};

export type PreparedAiJudgeConfigurationGeneration = {
  workflowInput: RunAiJudgeConfigurationGenerationInput;
  identities: AiJudgeConfigurationIdentityMap;
  attempt: number;
  attemptHistory: AiJudgeGenerationAttempt[];
};

export type GenerateAiJudgeConfigurationApplicationInput = GenerateAiJudgeConfigurationInput;
export type GenerateAiJudgeConfigurationApplicationResult = AiJudgeGenerationApplicationResult;

export type AiJudgeConfigurationGenerationJobData = {
  tenantId: UUIDType;
  userId: UUIDType;
  prepared: PreparedAiJudgeConfigurationGeneration;
  cancelRequested: boolean;
};
