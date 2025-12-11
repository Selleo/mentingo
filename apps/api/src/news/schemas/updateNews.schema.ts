import { Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type { Static } from "@sinclair/typebox";

export const updateNewsSchema = Type.Object({
  language: supportedLanguagesSchema,
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  summary: Type.Optional(Type.String({ maxLength: 500 })),
  content: Type.Optional(Type.String()),
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
  isPublic: Type.Optional(Type.Boolean()),
});

export const updateNewsParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export type UpdateNews = Static<typeof updateNewsSchema>;
export type UpdateNewsParams = Static<typeof updateNewsParamsSchema>;
