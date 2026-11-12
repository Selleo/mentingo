import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const courseDuplicatedDataSchema = Type.Object({
  tenantId: UUIDSchema,
  sourceCourseId: UUIDSchema,
  courseId: UUIDSchema,
  actorId: UUIDSchema,
  duplicatedAt: Type.String(),
});

export const courseDuplicatedEventSchema = Type.Object({
  courseDuplicatedData: courseDuplicatedDataSchema,
});
