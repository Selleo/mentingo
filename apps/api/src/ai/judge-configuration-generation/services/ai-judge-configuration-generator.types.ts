import type { SupportedLanguages } from "@repo/shared";
import type { AI_JUDGE_GENERATION_MODE } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import type {
  AiJudgeConfigurationValidationResult,
  AiJudgeGenerationLessonContext,
  AiJudgeValidationIssue,
  ReferencedAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";

type AiJudgeConfigurationGeneratorContext = {
  language: SupportedLanguages;
  lessonContext: AiJudgeGenerationLessonContext;
  brief?: string;
  creatorInstruction?: string;
};

export type CreateAiJudgeConfigurationDraftInput = AiJudgeConfigurationGeneratorContext & {
  mode: typeof AI_JUDGE_GENERATION_MODE.CREATE;
  brief: string;
};

export type ImproveAiJudgeConfigurationDraftInput = AiJudgeConfigurationGeneratorContext & {
  mode: typeof AI_JUDGE_GENERATION_MODE.IMPROVE;
  instruction: string;
  currentConfiguration: ReferencedAiJudgeConfiguration;
  latestValidation?: AiJudgeConfigurationValidationResult;
};

export type RepairAiJudgeConfigurationDraftInput = AiJudgeConfigurationGeneratorContext & {
  mode: typeof AI_JUDGE_GENERATION_MODE.REPAIR;
  currentConfiguration: ReferencedAiJudgeConfiguration;
  blockingIssues: AiJudgeValidationIssue[];
};

export type GenerateAiJudgeConfigurationDraftInput =
  | CreateAiJudgeConfigurationDraftInput
  | ImproveAiJudgeConfigurationDraftInput
  | RepairAiJudgeConfigurationDraftInput;
