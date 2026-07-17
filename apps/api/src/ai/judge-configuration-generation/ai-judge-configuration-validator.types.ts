import type { SupportedLanguages } from "@repo/shared";
import type {
  AiJudgeGenerationLessonContext,
  ReferencedAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.schema";

export type ValidateAiJudgeConfigurationDraftInput = {
  language: SupportedLanguages;
  lessonContext: AiJudgeGenerationLessonContext;
  configuration: ReferencedAiJudgeConfiguration;
  brief?: string;
};
