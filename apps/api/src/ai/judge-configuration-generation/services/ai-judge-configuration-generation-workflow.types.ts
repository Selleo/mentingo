import type {
  CreateAiJudgeConfigurationDraftInput,
  ImproveAiJudgeConfigurationDraftInput,
  RepairAiJudgeConfigurationDraftInput,
} from "./ai-judge-configuration-generator.types";
import type {
  AiJudgeGenerationAttempt,
  AiJudgeGenerationProgressEvent,
  ReferencedAiJudgeConfiguration,
} from "../schemas/ai-judge-configuration-generation.schema";

export type StartAiJudgeConfigurationGenerationInput =
  | CreateAiJudgeConfigurationDraftInput
  | ImproveAiJudgeConfigurationDraftInput;

export type RunAiJudgeConfigurationGenerationInput =
  | StartAiJudgeConfigurationGenerationInput
  | RepairAiJudgeConfigurationDraftInput;

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
  attempt?: number;
  attemptHistory?: AiJudgeGenerationAttempt[];
};
