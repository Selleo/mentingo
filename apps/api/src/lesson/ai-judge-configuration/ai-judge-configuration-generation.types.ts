import type {
  AiJudgeGenerationAttempt,
  AiJudgeGenerationApplicationProgressEvent,
  AiJudgeGenerationApplicationResult,
  GenerateAiJudgeConfigurationInput,
  ReferencedAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import type { RunAiJudgeConfigurationGenerationInput } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generation-workflow.types";
import type { AiJudgeConfigurationIdentityMap } from "src/ai/judge-configuration-generation/utils/ai-judge-configuration-references.types";
import type { UUIDType } from "src/common";

export type AiJudgeGenerationExecutionOptions = {
  reportProgress?: (progress: AiJudgeGenerationApplicationProgressEvent) => Promise<void> | void;
  isCancelled?: () => Promise<boolean> | boolean;
  onReferencedDraft?: (draft: ReferencedAiJudgeConfiguration) => Promise<void> | void;
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

export type AiJudgeGenerationStoredProgress = {
  progress: AiJudgeGenerationApplicationProgressEvent;
  referencedDraft?: ReferencedAiJudgeConfiguration;
};
