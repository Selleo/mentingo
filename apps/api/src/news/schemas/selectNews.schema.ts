import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { UUIDSchema, paginatedResponse } from "src/common";
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

export const getNewsResponseSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  content: Type.String(),
  summary: Type.String(),
  status: Type.String(),
  isPublic: Type.Boolean(),
  publishedAt: Type.Union([Type.String(), Type.Null()]),
  authorName: Type.String(),
});

export const uploadNewsFileResponseSchema = Type.Object({
  resourceId: UUIDSchema,
  fileKey: Type.String(),
  fileUrl: Type.String(),
});

export const newsListResponseSchema = Type.Array(getNewsResponseSchema);
export const paginatedNewsListResponseSchema = paginatedResponse(newsListResponseSchema);

export const deleteNewsLanguageResponseSchema = Type.Object({
  id: UUIDSchema,
  availableLocales: Type.Array(Type.String()),
});

export const deleteNewsResponseSchema = Type.Object({
  id: UUIDSchema,
});

export type SelectNews = Static<typeof selectNewsSchema>;
export type CreateNewsResponse = Static<typeof createNewsResponseSchema>;
export type GetNewsResponse = Static<typeof getNewsResponseSchema>;
export type UploadNewsFileResponse = Static<typeof uploadNewsFileResponseSchema>;
export type NewsListResponse = Static<typeof paginatedNewsListResponseSchema>;
export type DeleteNewsLanguageResponse = Static<typeof deleteNewsLanguageResponseSchema>;
export type DeleteNewsResponse = Static<typeof deleteNewsResponseSchema>;
