import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const previewNewsRequestSchema = Type.Object({
  newsId: UUIDSchema,
  language: supportedLanguagesSchema,
  content: Type.String(),
});

export const previewNewsResponseSchema = Type.Object({
  parsedContent: Type.String(),
});
