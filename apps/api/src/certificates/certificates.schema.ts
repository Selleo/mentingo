import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const certificateSchema = Type.Object({
  id: UUIDSchema,
  userId: UUIDSchema,
  courseId: UUIDSchema,
  courseTitle: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  completionDate: Type.Optional(Type.Union([Type.String({ format: "date-time" }), Type.Null()])),
  fullName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.Optional(Type.Union([Type.String({ format: "date-time" }), Type.Null()])),
});

export const allCertificatesSchema = Type.Array(certificateSchema);
