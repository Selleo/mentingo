import { type Static, Type } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const updateCourseMediaSchema = Type.Object({
  language: supportedLanguagesSchema,
  thumbnailPositionY: Type.Integer({
    minimum: 0,
    maximum: 100,
  }),
  image: Type.Optional(
    Type.String({
      format: "binary",
      description: "Course thumbnail image",
    }),
  ),
});

export type UpdateCourseMediaBody = Omit<Static<typeof updateCourseMediaSchema>, "image">;
