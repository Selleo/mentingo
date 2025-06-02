import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const studentsIdsSchema = Type.Object({
  studentId: UUIDSchema,
  createdAt: Type.String(),
});

export type StudentsIds = Static<typeof studentsIdsSchema>;
