import { Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type { Static } from "@sinclair/typebox";

export const updateArticleSchema = Type.Object({
  language: supportedLanguagesSchema,
  title: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  content: Type.Optional(Type.String()),
  status: Type.Optional(
    Type.Union([Type.Literal("draft"), Type.Literal("published"), Type.Literal("")]),
  ),
  isPublic: Type.Optional(
    Type.Union([Type.Boolean(), Type.Literal("true"), Type.Literal("false"), Type.Literal("")]),
  ),
  cover: Type.Optional(
    Type.String({
      format: "binary",
      description: "Cover image file",
    }),
  ),
});

export const updateArticleSectionSchema = Type.Object({
  language: supportedLanguagesSchema,
  title: Type.Optional(Type.String()),
});

export const updateArticleParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export type UpdateArticleSection = Static<typeof updateArticleSectionSchema>;
export type UpdateArticle = Static<typeof updateArticleSchema>;
export type UpdateArticleParams = Static<typeof updateArticleParamsSchema>;
