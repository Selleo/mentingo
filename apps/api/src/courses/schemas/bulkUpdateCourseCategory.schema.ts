import { type Static, Type } from "@sinclair/typebox";

import { baseResponse, UUIDSchema } from "src/common";

export const bulkUpdateCourseCategorySchema = Type.Object({
  ids: Type.Array(UUIDSchema),
  categoryId: UUIDSchema,
});

export const bulkUpdateCourseCategoryResponseSchema = baseResponse(
  Type.Object({ message: Type.String() }),
);

export type BulkUpdateCourseCategoryBody = Static<typeof bulkUpdateCourseCategorySchema>;
export type BulkUpdateCourseCategoryResponse = Static<
  typeof bulkUpdateCourseCategoryResponseSchema
>["data"];
