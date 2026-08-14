import { Type, type Static } from "@sinclair/typebox";

export const aiMentorPracticeContentSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 160 }),
    aiMentorName: Type.String({ minLength: 1, maxLength: 120 }),
  },
  { additionalProperties: false },
);

export type AiMentorPracticeContent = Static<typeof aiMentorPracticeContentSchema>;
