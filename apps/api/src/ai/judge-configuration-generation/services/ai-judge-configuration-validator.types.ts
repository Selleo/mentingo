import type { SupportedLanguages } from "@repo/shared";
import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeDraftChange,
  AiJudgeGenerationLessonContext,
  ReferencedAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";

export type ValidateAiJudgeConfigurationDraftInput = {
  language: SupportedLanguages;
  lessonContext: AiJudgeGenerationLessonContext;
  configuration: ReferencedAiJudgeConfiguration;
  brief?: string;
  creatorInstruction?: string;
  appliedChanges?: AiJudgeDraftChange[];
  previousValidation?: AiJudgeConfigurationValidationResult;
};
