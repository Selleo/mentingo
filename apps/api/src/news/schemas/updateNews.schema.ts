import { NEWS_STATUS } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type { Static } from "@sinclair/typebox";

export const updateNewsTranslationSchema = Type.Object({
  language: supportedLanguagesSchema,
  title: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  content: Type.Optional(Type.String()),
});

const updateNewsSharedFields = {
  status: Type.Optional(
    Type.Union([Type.Literal(NEWS_STATUS.DRAFT), Type.Literal(NEWS_STATUS.PUBLISHED)]),
  ),
  isPublic: Type.Optional(
    Type.Union([Type.Boolean(), Type.Literal("true"), Type.Literal("false")]),
  ),
};

export const updateNewsMultipartSchema = Type.Object({
  translations: Type.String(),
  ...updateNewsSharedFields,
});

export const updateNewsSchema = Type.Object({
  translations: Type.Array(updateNewsTranslationSchema),
  ...updateNewsSharedFields,
});

export const updateNewsParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export type UpdateNews = Static<typeof updateNewsSchema>;
export type UpdateNewsTranslation = Static<typeof updateNewsTranslationSchema>;
export type UpdateNewsParams = Static<typeof updateNewsParamsSchema>;
