import { type Static, Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { courseLearningOutcomesSchema } from "./courseLearningOutcomes.schema";
import { coursesStatusOptions } from "./courseQuery";

export const baseCourseSchema = Type.Object({
  title: Type.String(),
  description: Type.String(),
  status: Type.Optional(coursesStatusOptions),
  thumbnailS3Key: Type.Optional(Type.String()),
  thumbnailPositionY: Type.Optional(
    Type.Integer({
      minimum: 0,
      maximum: 100,
    }),
  ),
  learningOutcomes: Type.Optional(courseLearningOutcomesSchema),
  priceInCents: Type.Optional(Type.Integer()),
  currency: Type.Optional(Type.String()),
  categoryId: Type.String({ format: "uuid" }),
  isScorm: Type.Optional(Type.Boolean()),
  hasCertificate: Type.Optional(Type.Boolean()),
  language: supportedLanguagesSchema,
});

export const createCourseSchema = Type.Intersect([
  baseCourseSchema,
  Type.Object({
    chapters: Type.Optional(Type.Array(Type.String({ format: "uuid" }))),
  }),
]);

export type CreateCourseBody = Static<typeof createCourseSchema>;
