import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type { Static } from "@sinclair/typebox";

export const getArticleSectionResponseSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  baseLanguage: supportedLanguagesSchema,
  availableLocales: Type.Array(supportedLanguagesSchema),
  assignedArticlesCount: Type.Number(),
});

export type GetArticleSectionResponse = Static<typeof getArticleSectionResponseSchema>;
