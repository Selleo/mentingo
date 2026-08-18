import { Type } from "@sinclair/typebox";

import type { TSchema } from "@sinclair/typebox";
import type { promptId } from "../generated-prompts";

export const judgePromptSchema = Type.Object({
  language: Type.String(),
  lessonTitle: Type.String(),
  assessmentConfiguration: Type.String(),
});

const commonAiMentorPromptProperties = {
  lessonTitle: Type.String(),
  language: Type.String(),
  securityAndRagBlock: Type.String(),
  name: Type.String(),
  openingInstruction: Type.String(),
  additionalInstructions: Type.String(),
  groups: Type.Optional(Type.Array(Type.String())),
};

export const teacherPromptSchema = Type.Object({
  ...commonAiMentorPromptProperties,
  taskGoal: Type.String(),
  expertise: Type.String(),
  contentScope: Type.String(),
  teachingStyle: Type.String(),
  feedbackGuidance: Type.String(),
});

export const roleplayPromptSchema = Type.Object({
  ...commonAiMentorPromptProperties,
  scenario: Type.String(),
  aiRole: Type.String(),
  learnerRole: Type.String(),
  characterGoal: Type.String(),
  difficulty: Type.String(),
  factsAndConstraints: Type.String(),
});

export const summaryPromptSchema = Type.Object({
  language: Type.String(),
  content: Type.String(),
});

export const welcomePromptSchema = Type.Object(
  {
    systemPrompt: Type.String(),
  },
  { additionalProperties: false },
);

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

export const aiMentorConfigurationGeneratorBaseSchema = Type.Object(
  {
    language: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const aiMentorConfigurationGeneratorModeSchema = Type.Object(
  {},
  { additionalProperties: false },
);

export const aiMentorConfigurationValidatorSchema = Type.Object(
  {
    language: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const PROMPT_MAP = {
  judgePrompt: judgePromptSchema,
  roleplayPrompt: roleplayPromptSchema,
  teacherPrompt: teacherPromptSchema,
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
  aiMentorConfigurationGeneratorBase: aiMentorConfigurationGeneratorBaseSchema,
  aiMentorConfigurationGeneratorCreate: aiMentorConfigurationGeneratorModeSchema,
  aiMentorConfigurationGeneratorPractice: Type.Object({}, { additionalProperties: false }),
  aiMentorConfigurationGeneratorImprove: aiMentorConfigurationGeneratorModeSchema,
  aiMentorConfigurationGeneratorRepair: aiMentorConfigurationGeneratorModeSchema,
  aiMentorConfigurationValidator: aiMentorConfigurationValidatorSchema,
} satisfies Record<promptId, TSchema>;
