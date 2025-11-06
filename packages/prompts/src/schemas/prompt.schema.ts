import { Type } from "@sinclair/typebox";

const groupsSchema = Type.Optional(
  Type.Array(
    Type.Object({
      name: Type.String(),
      characteristic: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
);

export const judgePromptSchema = Type.Object({
  language: Type.String(),
  lessonInstructions: Type.String(),
  lessonTitle: Type.String(),
  lessonConditions: Type.String(),
});

export const aiPromptSchema = Type.Object({
  language: Type.String(),
  lessonTitle: Type.String(),
  lessonInstructions: Type.String(),
  securityAndRagBlock: Type.String(),
  groups: groupsSchema,
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
