import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const articleItemSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
});

export const articleSectionSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  articles: Type.Array(articleItemSchema),
});

export const getArticleSectionResponseSchema = Type.Object({
  sections: Type.Array(articleSectionSchema),
});

export type ArticleItem = Static<typeof articleItemSchema>;
export type GetArticleTocResponse = Static<typeof getArticleSectionResponseSchema>;
