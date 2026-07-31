import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { AI_MENTOR_PRACTICE_STATUSES } from "src/ai/ai-practice.types";
import { UUIDSchema } from "src/common";

const practiceAnswerSchema = Type.String({ minLength: 1, maxLength: 1000 });

export const createAiMentorPracticeSchema = Type.Object({
  timezone: Type.String({ minLength: 1, maxLength: 100 }),
  language: Type.Enum(SUPPORTED_LANGUAGES),
  challenge: practiceAnswerSchema,
  counterpart: practiceAnswerSchema,
  desiredOutcome: practiceAnswerSchema,
});

export const aiMentorPracticeQuerySchema = Type.Object({
  timezone: Type.String({ minLength: 1, maxLength: 100 }),
});

export const aiMentorPracticeSessionSchema = Type.Object({
  id: UUIDSchema,
  practiceDate: Type.String(),
  timezone: Type.String(),
  language: Type.Enum(SUPPORTED_LANGUAGES),
  challenge: Type.String(),
  counterpart: Type.String(),
  desiredOutcome: Type.String(),
  title: Type.Union([Type.String(), Type.Null()]),
  instructions: Type.Union([Type.String(), Type.Null()]),
  threadId: Type.Union([UUIDSchema, Type.Null()]),
  status: Type.Enum(AI_MENTOR_PRACTICE_STATUSES),
  errorCode: Type.Union([Type.String(), Type.Null()]),
});

export const nullableAiMentorPracticeSessionSchema = Type.Union([
  aiMentorPracticeSessionSchema,
  Type.Null(),
]);

export type CreateAiMentorPracticeBody = Static<typeof createAiMentorPracticeSchema>;
export type AiMentorPracticeSessionResponse = Static<typeof aiMentorPracticeSessionSchema>;
