import { Type } from "@sinclair/typebox";

import { UUIDSchema, paginatedResponse } from "src/common";

// zmienić typy w datach ze string na date-time i naprawić żeby nie było błędu z formatem { format: "date-time" } - completionDate, createdAt, updatedAt
export const certificateSchema = Type.Object({
  id: UUIDSchema,
  userId: UUIDSchema,
  courseId: UUIDSchema,
  courseTitle: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  completionDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  fullName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String(),
  updatedAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const allCertificatesSchema = Type.Array(certificateSchema);

export const paginatedCertificatesSchema = paginatedResponse(allCertificatesSchema);
