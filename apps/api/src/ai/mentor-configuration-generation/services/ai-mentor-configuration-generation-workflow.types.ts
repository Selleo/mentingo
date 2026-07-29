import type {
  CreateAiMentorConfigurationDraftInput,
  ImproveAiMentorConfigurationDraftInput,
  RepairAiMentorConfigurationDraftInput,
} from "./ai-mentor-configuration-generator.types";
import type {
  AiMentorConfigurationGenerationAttempt,
  AiMentorConfigurationGenerationProgressEvent,
} from "../schemas/ai-mentor-configuration-generation.schema";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

export type StartAiMentorConfigurationGenerationInput =
  | CreateAiMentorConfigurationDraftInput
  | ImproveAiMentorConfigurationDraftInput;

export type RunAiMentorConfigurationGenerationInput =
  | StartAiMentorConfigurationGenerationInput
  | RepairAiMentorConfigurationDraftInput;

export type AiMentorConfigurationGenerationWorkflowOptions = {
  reportProgress?: (
    progress: AiMentorConfigurationGenerationProgressEvent,
  ) => Promise<void> | void;
  isCancelled?: () => Promise<boolean> | boolean;
  onDraft?: (draft: AiMentorConfigurationContent) => Promise<void> | void;
  attempt?: number;
  attemptHistory?: AiMentorConfigurationGenerationAttempt[];
};
