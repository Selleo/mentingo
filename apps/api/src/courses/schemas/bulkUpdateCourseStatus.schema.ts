import { type Static, Type } from "@sinclair/typebox";

import { baseResponse, UUIDSchema } from "src/common";

import { coursesStatusOptions } from "./courseQuery";

export const bulkUpdateCourseStatusSchema = Type.Object({
  ids: Type.Array(UUIDSchema),
  status: coursesStatusOptions,
});

export const bulkUpdateCourseStatusResponseSchema = baseResponse(
  Type.Object({ message: Type.String() }),
);

export type BulkUpdateCourseStatusBody = Static<typeof bulkUpdateCourseStatusSchema>;
export type BulkUpdateCourseStatusResponse = Static<
  typeof bulkUpdateCourseStatusResponseSchema
>["data"];
