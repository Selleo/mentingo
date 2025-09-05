import { type Static, Type } from "@sinclair/typebox";

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
  }),
);

export type UpdateCourseBody = Static<typeof updateCourseSchema>;
