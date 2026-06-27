import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const duplicateCourseResponseSchema = Type.Object({
  courseId: UUIDSchema,
  jobId: Type.String(),
});

export type DuplicateCourseResponse = Static<typeof duplicateCourseResponseSchema>;

export const courseDuplicationJobStatusResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  state: Type.String(),
  attemptsMade: Type.Number(),
  failedReason: Type.Union([Type.String(), Type.Null()]),
});

export type CourseDuplicationJobStatusResponse = Static<
  typeof courseDuplicationJobStatusResponseSchema
>;
