import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";
import type { InferSelectModel } from "drizzle-orm";
import type { studentCourses } from "src/storage/schema";

export type StudentCourseSelect = InferSelectModel<typeof studentCourses>;

export const enrolledStudentSchema = Type.Object({
  firstName: Type.String(),
  lastName: Type.String(),
  email: Type.String(),
  enrolledAt: Type.Union([Type.String(), Type.Null()]),
  id: Type.String({ format: "uuid" }),
});

export type EnrolledStudent = Static<typeof enrolledStudentSchema>;
