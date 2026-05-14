import { type Static, Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { coursesStatusOptions } from "src/courses/schemas/courseQuery";

export const createScormCourseSchema = Type.Object({
  title: Type.String(),
  description: Type.String(),
  categoryId: Type.String({ format: "uuid" }),
  language: supportedLanguagesSchema,
  status: Type.Optional(coursesStatusOptions),
  thumbnailS3Key: Type.Optional(Type.String()),
  priceInCents: Type.Optional(Type.Integer()),
  currency: Type.Optional(Type.String()),
  hasCertificate: Type.Optional(Type.Boolean()),
});

export type CreateScormCourseBody = Static<typeof createScormCourseSchema>;
