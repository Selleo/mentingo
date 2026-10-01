import { type Static, Type } from "@sinclair/typebox";

import { baseResponse, UUIDSchema } from "src/common";

export const bulkArchiveCourseSchema = Type.Object({
  ids: Type.Array(UUIDSchema, { minItems: 1 }),
  isArchived: Type.Boolean(),
});

export const bulkArchiveCourseResponseSchema = baseResponse(
  Type.Object({ message: Type.String() }),
);

export type BulkArchiveCourseBody = Static<typeof bulkArchiveCourseSchema>;
export type BulkArchiveCourseResponse = Static<typeof bulkArchiveCourseResponseSchema>["data"];
