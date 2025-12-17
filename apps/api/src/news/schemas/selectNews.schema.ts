import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { UUIDSchema, paginatedResponse } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { news } from "src/storage/schema";

import type { Static } from "@sinclair/typebox";

const baseNewsSchema = createSelectSchema(news, {
  publishedAt: Type.Union([Type.String(), Type.Null()]),
});

export const selectNewsSchema = Type.Composite([
  baseNewsSchema,
  Type.Object({
    authorName: Type.String(),
    authorEmail: Type.String(),
  }),
]);

export const createNewsResponseSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
});

export const newsResourceSchema = Type.Object({
  id: UUIDSchema,
  fileUrl: Type.String(),
  contentType: Type.String(),
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  fileName: Type.Optional(Type.String()),
});

export const newsResourcesSchema = Type.Object({
  images: Type.Array(newsResourceSchema),
  videos: Type.Array(newsResourceSchema),
  attachments: Type.Array(newsResourceSchema),
  coverImage: Type.Optional(newsResourceSchema),
});

export const getNewsWithPlainContentSchema = Type.Object({
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
  resources: Type.Optional(newsResourcesSchema),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  nextNews: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
  previousNews: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
});

export const getNewsResponseSchema = Type.Omit(getNewsWithPlainContentSchema, ["plainContent"]);

export const uploadNewsFileResponseSchema = Type.Object({
  resourceId: UUIDSchema,
});

export const newsListResponseSchema = Type.Array(getNewsResponseSchema);
export const paginatedNewsListResponseSchema = paginatedResponse(newsListResponseSchema);

export type SelectNews = Static<typeof selectNewsSchema>;
export type CreateNewsResponse = Static<typeof createNewsResponseSchema>;
export type GetNewsResponseWithPlainContent = Static<typeof getNewsResponseSchema>;
export type GetNewsResponse = Static<typeof getNewsResponseSchema>;
export type UploadNewsFileResponse = Static<typeof uploadNewsFileResponseSchema>;
export type NewsListResponse = Static<typeof paginatedNewsListResponseSchema>;
export type NewsResource = Static<typeof newsResourceSchema>;
export type NewsResources = Static<typeof newsResourcesSchema>;
