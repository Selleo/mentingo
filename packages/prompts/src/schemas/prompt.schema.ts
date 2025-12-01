import { Type } from "@sinclair/typebox";

export const judgePromptSchema = Type.Object({
  language: Type.String(),
  lessonInstructions: Type.String(),
  lessonTitle: Type.String(),
  lessonConditions: Type.String(),
});

export const aiPromptSchema = Type.Object({
  lessonTitle: Type.String(),
  lessonInstructions: Type.String(),
  securityAndRagBlock: Type.String(),
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

export const PROMPT_MAP = {
  judgePrompt: judgePromptSchema,
  mentorPrompt: aiPromptSchema,
  roleplayPrompt: aiPromptSchema,
  teacherPrompt: aiPromptSchema,
  summaryPrompt: summaryPromptSchema,
  welcomePrompt: welcomePromptSchema,
  securityAndRagBlock: securityAndRagBlockSchema,
};
