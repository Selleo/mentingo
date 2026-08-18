import type { AI_MENTOR_CONFIGURATION_GENERATION_PURPOSE } from "../ai-mentor-configuration-generation.constants";
import type { AiMentorType, SupportedLanguages } from "@repo/shared";
import type {
  AiMentorConfigurationDraft,
  AiMentorConfigurationValidationIssue,
  AiMentorConfigurationValidationResult,
  AiMentorGenerationLessonContext,
} from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

type AiMentorConfigurationGeneratorContext = {
  configurationType: AiMentorType;
  language: SupportedLanguages;
  lessonContext: AiMentorGenerationLessonContext;
  brief?: string;
  creatorInstruction?: string;
  generationPurpose?: (typeof AI_MENTOR_CONFIGURATION_GENERATION_PURPOSE)[keyof typeof AI_MENTOR_CONFIGURATION_GENERATION_PURPOSE];
};

export type CreateAiMentorConfigurationDraftInput = AiMentorConfigurationGeneratorContext & {
  mode: "create";
  brief: string;
};

export type ImproveAiMentorConfigurationDraftInput = AiMentorConfigurationGeneratorContext & {
  mode: "improve";
  instruction: string;
  currentConfiguration: AiMentorConfigurationDraft;
  latestValidation?: AiMentorConfigurationValidationResult;
};

export type RepairAiMentorConfigurationDraftInput = AiMentorConfigurationGeneratorContext & {
  mode: "repair";
  currentConfiguration: AiMentorConfigurationContent;
  blockingIssues: AiMentorConfigurationValidationIssue[];
};

export type GenerateAiMentorConfigurationDraftInput =
  | CreateAiMentorConfigurationDraftInput
  | ImproveAiMentorConfigurationDraftInput
  | RepairAiMentorConfigurationDraftInput;
