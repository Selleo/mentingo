import type {
  AiJudgeConfigurationGenerationWorkflowOptions,
  StartAiJudgeConfigurationGenerationInput,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation-workflow.types";
import type {
  AiJudgeGenerationApplicationResult,
  GenerateAiJudgeConfigurationInput,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationIdentityMap } from "src/ai/judge-configuration-generation/ai-judge-configuration-references.types";

export type AiJudgeGenerationExecutionOptions = Omit<
  AiJudgeConfigurationGenerationWorkflowOptions,
  "onDraft"
>;

export type PreparedAiJudgeConfigurationGeneration = {
  workflowInput: StartAiJudgeConfigurationGenerationInput;
  identities: AiJudgeConfigurationIdentityMap;
};

export type GenerateAiJudgeConfigurationApplicationInput = GenerateAiJudgeConfigurationInput;
export type GenerateAiJudgeConfigurationApplicationResult = AiJudgeGenerationApplicationResult;
