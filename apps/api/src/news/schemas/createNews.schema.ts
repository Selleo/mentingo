import { Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type { Static } from "@sinclair/typebox";

export const createNewsSchema = Type.Object({
  language: supportedLanguagesSchema,
});

export type CreateNews = Static<typeof createNewsSchema>;
