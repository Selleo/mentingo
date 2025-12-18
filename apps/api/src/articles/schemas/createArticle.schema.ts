import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type { Static } from "@sinclair/typebox";

export const createArticleSchema = Type.Object({
  language: supportedLanguagesSchema,
  sectionId: UUIDSchema,
});

export const createLanguageArticleSchema = Type.Object({
  language: supportedLanguagesSchema,
});

export const createArticleSectionSchema = Type.Object({
  language: supportedLanguagesSchema,
});

export const uploadFileSchema = Type.Object({
  file: Type.Optional(
    Type.String({
      format: "binary",
      description: "File",
    }),
  ),
  language: supportedLanguagesSchema,
  title: Type.String(),
  description: Type.String(),
});

export type CreateLanguageArticle = Static<typeof createLanguageArticleSchema>;
export type UploadFile = Static<typeof uploadFileSchema>;
export type CreateArticle = Static<typeof createArticleSchema>;
export type CreateArticleSection = Static<typeof createArticleSectionSchema>;
