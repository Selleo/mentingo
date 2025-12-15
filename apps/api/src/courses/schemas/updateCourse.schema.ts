import { type Static, Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import { coursesStatusOptions } from "./courseQuery";

export const updateCourseSchema = Type.Partial(
  Type.Object({
    title: Type.String(),
    description: Type.String(),
    thumbnailS3Key: Type.String(),
    status: coursesStatusOptions,
    priceInCents: Type.Integer(),
    currency: Type.String(),
    categoryId: Type.String({ format: "uuid" }),
    chapters: Type.Array(Type.String({ format: "uuid" })),
    archived: Type.Optional(Type.Boolean()),
    language: supportedLanguagesSchema,
  }),
);

export type UpdateCourseBody = Static<typeof updateCourseSchema>;
