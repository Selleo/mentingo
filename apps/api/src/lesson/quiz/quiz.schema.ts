import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, baseResponse } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const quizSettingsSchema = Type.Object({
  shuffleQuestions: Type.Optional(Type.Boolean()),
  shuffleAnswers: Type.Optional(Type.Boolean()),
  availableFrom: Type.Optional(Type.Union([Type.String({ format: "date-time" }), Type.Null()])),
  availableUntil: Type.Optional(Type.Union([Type.String({ format: "date-time" }), Type.Null()])),
  timeLimitMinutes: Type.Optional(
    Type.Union([Type.Integer({ minimum: 1, maximum: 1440 }), Type.Null()]),
  ),
  passedFeedback: Type.Optional(Type.String({ maxLength: 5000 })),
  failedFeedback: Type.Optional(Type.String({ maxLength: 5000 })),
});
export const quizAttemptSchema = Type.Object({
  id: Type.String(),
  startedAt: Type.String(),
  expiresAt: Type.Union([Type.String(), Type.Null()]),
  status: Type.Union([Type.Literal("active"), Type.Literal("submitted"), Type.Literal("expired")]),
  questionOrder: Type.Array(Type.String()),
  optionOrder: Type.Object({}, { additionalProperties: Type.Array(Type.String()) }),
});
export const quizAttemptRequestSchema = Type.Object({
  lessonId: UUIDSchema,
  language: supportedLanguagesSchema,
});
export const quizAttemptResponseSchema = baseResponse(Type.Union([quizAttemptSchema, Type.Null()]));
export type QuizSettingsInput = Static<typeof quizSettingsSchema>;
export type QuizAttemptRequest = Static<typeof quizAttemptRequestSchema>;
