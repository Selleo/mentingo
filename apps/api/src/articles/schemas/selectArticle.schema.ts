import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { articles } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

import type { Static } from "@sinclair/typebox";

const baseArticleSchema = omitTenantId(
  createSelectSchema(articles, {
    publishedAt: Type.Union([Type.String(), Type.Null()]),
  }),
);

export const selectArticleSchema = Type.Composite([
  baseArticleSchema,
  Type.Object({
    authorName: Type.String(),
    authorEmail: Type.String(),
  }),
]);

export const createArticleResponseSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
});

export const createArticleSectionResponseSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
});

export const articleResourceSchema = Type.Object({
  id: UUIDSchema,
  fileUrl: Type.String(),
  contentType: Type.String(),
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  fileName: Type.Optional(Type.String()),
});

export const articleResourcesSchema = Type.Object({
  images: Type.Array(articleResourceSchema),
  videos: Type.Array(articleResourceSchema),
  attachments: Type.Array(articleResourceSchema),
  coverImage: Type.Optional(articleResourceSchema),
});

export const getArticleResponseSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  content: Type.String(),
  plainContent: Type.String(),
  summary: Type.String(),
  status: Type.String(),
  isPublic: Type.Boolean(),
  baseLanguage: supportedLanguagesSchema,
  availableLocales: Type.Array(supportedLanguagesSchema),
  publishedAt: Type.Union([Type.String(), Type.Null()]),
  authorName: Type.String(),
  authorId: UUIDSchema,
  resources: Type.Optional(articleResourcesSchema),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  nextArticle: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
  previousArticle: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
});

export const getArticlesResponseSchema = Type.Array(
  Type.Omit(getArticleResponseSchema, [
    "content",
    "summary",
    "plainContent",
    "baseLanguage",
    "availableLocales",
  ]),
);

export const uploadArticleFileResponseSchema = Type.Object({
  resourceId: UUIDSchema,
});

export type SelectArticle = Static<typeof selectArticleSchema>;
export type CreateArticleResponse = Static<typeof createArticleResponseSchema>;
export type GetArticleResponse = Static<typeof getArticleResponseSchema>;
export type GetArticlesResponse = Static<typeof getArticlesResponseSchema>;
export type UploadArticleFileResponse = Static<typeof uploadArticleFileResponseSchema>;
export type ArticleResource = Static<typeof articleResourceSchema>;
export type ArticleResources = Static<typeof articleResourcesSchema>;
export type CreateArticleSectionResponse = Static<typeof createArticleSectionResponseSchema>;
