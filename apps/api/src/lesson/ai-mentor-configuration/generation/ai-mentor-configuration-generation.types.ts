import type {
  AiMentorConfigurationGenerationAttempt,
  AiMentorConfigurationGenerationProgressEvent,
  AiMentorConfigurationGenerationResult,
  GenerateAiMentorConfigurationInput,
} from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";
import type { RunAiMentorConfigurationGenerationInput } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-generation-workflow.types";
import type { UUIDType } from "src/common";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

export type PreparedAiMentorConfigurationGeneration = {
  workflowInput: RunAiMentorConfigurationGenerationInput;
  attempt: number;
  attemptHistory: AiMentorConfigurationGenerationAttempt[];
};

export type AiMentorConfigurationGenerationExecutionOptions = {
  reportProgress?: (
    progress: AiMentorConfigurationGenerationProgressEvent,
  ) => Promise<void> | void;
  isCancelled?: () => Promise<boolean> | boolean;
  onDraft?: (draft: AiMentorConfigurationContent) => Promise<void> | void;
};

export type AiMentorConfigurationGenerationJobData = {
  tenantId: UUIDType;
  userId: UUIDType;
  prepared: PreparedAiMentorConfigurationGeneration;
  cancelRequested: boolean;
};

export type AiMentorConfigurationGenerationStoredProgress = {
  progress: AiMentorConfigurationGenerationProgressEvent;
  latestDraft?: AiMentorConfigurationContent;
};

export type GenerateAiMentorConfigurationApplicationInput =
  GenerateAiMentorConfigurationInput;
export type GenerateAiMentorConfigurationApplicationResult =
  AiMentorConfigurationGenerationResult;
