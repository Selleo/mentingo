import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const previewArticleRequestSchema = Type.Object({
  articleId: UUIDSchema,
  language: supportedLanguagesSchema,
  content: Type.String(),
});

export const previewArticleResponseSchema = Type.Object({
  parsedContent: Type.String(),
});

export type PreviewArticleRequest = Static<typeof previewArticleRequestSchema>;
export type PreviewArticleResponse = Static<typeof previewArticleResponseSchema>;
