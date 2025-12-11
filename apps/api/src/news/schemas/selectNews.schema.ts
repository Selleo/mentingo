import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

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

export type SelectNews = Static<typeof selectNewsSchema>;
export type CreateNewsResponse = Static<typeof createNewsResponseSchema>;
