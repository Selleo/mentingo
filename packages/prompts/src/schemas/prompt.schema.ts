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

export const aiMentorPracticeGenerationSchema = Type.Object({
  language: Type.String(),
  challenge: Type.String(),
  counterpart: Type.String(),
  desiredOutcome: Type.String(),
});
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
  learnerNameAddon: learnerNameAddonSchema,
  aiJudgeConfigurationGeneratorBase: aiJudgeConfigurationGeneratorBaseSchema,
  aiJudgeConfigurationGeneratorCreate: aiJudgeConfigurationGeneratorModeSchema,
  aiJudgeConfigurationGeneratorImprove: aiJudgeConfigurationGeneratorModeSchema,
  aiJudgeConfigurationGeneratorRepair: aiJudgeConfigurationGeneratorModeSchema,
  aiJudgeConfigurationValidator: aiJudgeConfigurationValidatorSchema,
  aiMentorPracticeGeneration: aiMentorPracticeGenerationSchema,
} satisfies Record<promptId, TSchema>;
