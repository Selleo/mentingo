import type {
  AiJudgeGenerationProgressEvent,
  ReferencedAiJudgeConfiguration,
} from "./ai-judge-configuration-generation.schema";
import type {
  CreateAiJudgeConfigurationDraftInput,
  ImproveAiJudgeConfigurationDraftInput,
} from "./ai-judge-configuration-generator.types";

export type StartAiJudgeConfigurationGenerationInput =
  | CreateAiJudgeConfigurationDraftInput
  | ImproveAiJudgeConfigurationDraftInput;

export type AiJudgeGenerationProgressReporter = (
  progress: AiJudgeGenerationProgressEvent,
) => Promise<void> | void;

export type AiJudgeGenerationCancellationCheck = () => Promise<boolean> | boolean;

export type AiJudgeGenerationDraftObserver = (
  draft: ReferencedAiJudgeConfiguration,
) => Promise<void> | void;

export type AiJudgeConfigurationGenerationWorkflowOptions = {
  reportProgress?: AiJudgeGenerationProgressReporter;
  isCancelled?: AiJudgeGenerationCancellationCheck;
  onDraft?: AiJudgeGenerationDraftObserver;
};
