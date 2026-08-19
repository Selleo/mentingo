import type { SupportedLanguages } from "@repo/shared";
import type {
  AiMentorConfigurationDraftChange,
  AiMentorConfigurationValidationResult,
  AiMentorGenerationLessonContext,
} from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

export type ValidateAiMentorConfigurationDraftInput = {
  language: SupportedLanguages;
  lessonContext: AiMentorGenerationLessonContext;
  configuration: AiMentorConfigurationContent;
  brief?: string;
  creatorInstruction?: string;
  appliedChanges?: AiMentorConfigurationDraftChange[];
  previousValidation?: AiMentorConfigurationValidationResult;
};
