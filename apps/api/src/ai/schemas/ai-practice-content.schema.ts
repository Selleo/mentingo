import { Type, type Static } from "@sinclair/typebox";

export const aiMentorPracticeContentSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 160 }),
    aiMentorName: Type.String({ minLength: 1, maxLength: 120 }),
    instructions: Type.String({ minLength: 1, maxLength: 4000 }),
  },
  { additionalProperties: false },
);

export type AiMentorPracticeContent = Static<typeof aiMentorPracticeContentSchema>;
