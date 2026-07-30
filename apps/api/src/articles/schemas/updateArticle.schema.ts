import { Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type { Static } from "@sinclair/typebox";

export const updateArticleTranslationSchema = Type.Object({
  language: supportedLanguagesSchema,
  title: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  content: Type.Optional(Type.String()),
});

const updateArticleFields = {
  isPublic: Type.Optional(Type.Boolean()),
};

export const updateArticleSchema = Type.Object({
  translations: Type.Array(updateArticleTranslationSchema),
  ...updateArticleFields,
});

export const updateArticleMultipartSchema = Type.Object({
  translations: Type.String(),
  ...updateArticleFields,
});

export const updateArticleSectionSchema = Type.Object({
  translations: Type.Array(
    Type.Object({
      language: supportedLanguagesSchema,
      title: Type.Optional(Type.String()),
    }),
  ),
});

export const updateArticleParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export type UpdateArticleSection = Static<typeof updateArticleSectionSchema>;
export type UpdateArticle = Static<typeof updateArticleSchema>;
export type UpdateArticleTranslation = Static<typeof updateArticleTranslationSchema>;
export type UpdateArticleParams = Static<typeof updateArticleParamsSchema>;
