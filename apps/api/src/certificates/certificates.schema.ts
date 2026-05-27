import { CERTIFICATE_RESET_SCOPES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema, paginatedResponse } from "src/common";
import { certificateValiditySchema } from "src/courses/types/settings";

export const certificateSchema = Type.Object({
  id: UUIDSchema,
  userId: UUIDSchema,
  courseId: UUIDSchema,
  courseTitle: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  completionDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  fullName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  certificateSignatureUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  certificateFontColor: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  issuedAt: Type.String(),
  expiresAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String(),
});

export const downloadCertificateSchema = Type.Object({
  certificateId: UUIDSchema,
  language: Type.Enum(SUPPORTED_LANGUAGES),
});

export const createCertificateShareLinkSchema = Type.Object({
  certificateId: UUIDSchema,
  language: Type.Optional(Type.String()),
});

export const certificateShareLinkResponseSchema = Type.Object({
  shareUrl: Type.String(),
  linkedinShareUrl: Type.String(),
});

export const resetCourseCertificatesSchema = Type.Object({
  scope: Type.Enum(CERTIFICATE_RESET_SCOPES),
  groupIds: Type.Optional(Type.Array(UUIDSchema)),
  userIds: Type.Optional(Type.Array(UUIDSchema)),
  sendEmail: Type.Optional(Type.Boolean()),
});

export const resetCourseCertificatesResponseSchema = Type.Object({
  affectedCertificateCount: Type.Number(),
  affectedUserCount: Type.Number(),
});

export const certificateResetOptionsResponseSchema = Type.Object({
  groups: Type.Array(
    Type.Object({
      id: UUIDSchema,
      name: Type.String(),
      activeCertificateCount: Type.Number(),
    }),
  ),
  activeCertificateUserCount: Type.Number(),
});

export const certificateResetUsersSchema = Type.Array(
  Type.Object({
    id: UUIDSchema,
    firstName: Type.String(),
    lastName: Type.String(),
    email: Type.String(),
  }),
);

export const certificateValidityImpactResponseSchema = Type.Object({
  activeCertificateCount: Type.Number(),
  immediatelyExpiringCertificateCount: Type.Number(),
});

export const certificateValidityImpactSchema = Type.Object({
  certificateValidity: Type.Union([certificateValiditySchema, Type.Null()]),
});

export const allCertificatesSchema = Type.Array(certificateSchema);
export const singleCertificateSchema = Type.Union([certificateSchema, Type.Null()]);

export const paginatedCertificatesSchema = paginatedResponse(allCertificatesSchema);
