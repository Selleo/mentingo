import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const setCourseStudentModeSchema = Type.Object({
  enabled: Type.Boolean(),
});

export const setCourseStudentModeResponseSchema = Type.Object({
  courseId: UUIDSchema,
  enabled: Type.Boolean(),
  studentModeCourseIds: Type.Array(UUIDSchema),
});

export type SetCourseStudentMode = Static<typeof setCourseStudentModeSchema>;
export type SetCourseStudentModeResponse = Static<typeof setCourseStudentModeResponseSchema>;
