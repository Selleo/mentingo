import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const createCoursesEnrollmentSchema = Type.Object({
  studentIds: Type.Array(UUIDSchema),
});

export type CreateCoursesEnrollment = Static<typeof createCoursesEnrollmentSchema>;
