import { Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type { Static } from "@sinclair/typebox";

export const updateNewsSchema = Type.Object({
  language: supportedLanguagesSchema,
  title: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  content: Type.Optional(Type.String()),
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
  isPublic: Type.Optional(
    Type.Union([Type.Boolean(), Type.Literal("true"), Type.Literal("false")]),
  ),
  cover: Type.Optional(
    Type.String({
      format: "binary",
      description: "Cover image file",
    }),
  ),
});

export const updateNewsParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export type UpdateNews = Static<typeof updateNewsSchema>;
export type UpdateNewsParams = Static<typeof updateNewsParamsSchema>;
