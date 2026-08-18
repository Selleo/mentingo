import { Type } from "@sinclair/typebox";

import type { TSchema } from "@sinclair/typebox";
import type { promptId } from "../generated-prompts";

export const judgePromptSchema = Type.Object({
  language: Type.String(),
  lessonTitle: Type.String(),
  assessmentConfiguration: Type.String(),
});

export const aiPromptSchema = Type.Object({
  lessonTitle: Type.String(),
  lessonInstructions: Type.String(),
  securityAndRagBlock: Type.String(),
  name: Type.String(),
  groups: Type.Optional(Type.Array(Type.String())),
});

export const summaryPromptSchema = Type.Object({
  language: Type.String(),
  content: Type.String(),
});

export const welcomePromptSchema = Type.Object({
  systemPrompt: Type.String(),
});

export const securityAndRagBlockSchema = Type.Object({
  language: Type.String(),
});

export const translationPromptSchema = Type.Object({
  language: Type.String(),
});

export const voiceMentorAddonSchema = Type.Object({
  language: Type.String(),
});

export const voiceMentorTimingAddonSchema = Type.Object({
  elapsedMs: Type.Integer({ minimum: 0 }),
  speechMs: Type.Integer({ minimum: 0 }),
  pauseCount: Type.Integer({ minimum: 0 }),
  longestPauseMs: Type.Integer({ minimum: 0 }),
  averagePauseMs: Type.String(),
  segmentCount: Type.Integer({ minimum: 0 }),
  wordCount: Type.Integer({ minimum: 0 }),
  wordsPerMinute: Type.String(),
  timingPrecision: Type.String({ minLength: 1 }),
});

export const learnerNameAddonSchema = Type.Object({
  learnerFirstName: Type.String({ minLength: 1 }),
  language: Type.String({ minLength: 1 }),
});

export const aiJudgeConfigurationGeneratorBaseSchema = Type.Object(
  {
    language: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const aiJudgeConfigurationGeneratorModeSchema = Type.Object(
  {},
  { additionalProperties: false },
);

export const aiJudgeConfigurationValidatorSchema = Type.Object(
  {
    language: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const PROMPT_MAP = {
  judgePrompt: judgePromptSchema,
  mentorPrompt: aiPromptSchema,
  roleplayPrompt: aiPromptSchema,
  teacherPrompt: aiPromptSchema,
  summaryPrompt: summaryPromptSchema,
  welcomePrompt: welcomePromptSchema,
  securityAndRagBlock: securityAndRagBlockSchema,
  translationPrompt: translationPromptSchema,
  voiceMentorAddon: voiceMentorAddonSchema,
  voiceMentorTimingAddon: voiceMentorTimingAddonSchema,
  learnerNameAddon: learnerNameAddonSchema,
  aiJudgeConfigurationGeneratorBase: aiJudgeConfigurationGeneratorBaseSchema,
  aiJudgeConfigurationGeneratorCreate: aiJudgeConfigurationGeneratorModeSchema,
  aiJudgeConfigurationGeneratorImprove: aiJudgeConfigurationGeneratorModeSchema,
  aiJudgeConfigurationGeneratorRepair: aiJudgeConfigurationGeneratorModeSchema,
  aiJudgeConfigurationValidator: aiJudgeConfigurationValidatorSchema,
} satisfies Record<promptId, TSchema>;
