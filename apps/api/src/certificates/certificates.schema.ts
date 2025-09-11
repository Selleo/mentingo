import { Type } from "@sinclair/typebox";

import { UUIDSchema, paginatedResponse } from "src/common";

export const certificateSchema = Type.Object({
  id: UUIDSchema,
  userId: UUIDSchema,
  courseId: UUIDSchema,
  courseTitle: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  completionDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  fullName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String(),
});

export const downloadCertificateSchema = Type.Object({
  html: Type.String(),
  filename: Type.Optional(Type.String()),
});

export const allCertificatesSchema = Type.Array(certificateSchema);

export const paginatedCertificatesSchema = paginatedResponse(allCertificatesSchema);
