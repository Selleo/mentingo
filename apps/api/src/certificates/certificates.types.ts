import type {
  allCertificatesSchema,
  certificateShareLinkResponseSchema,
  certificateResetOptionsResponseSchema,
  certificateResetUsersSchema,
  certificateSchema,
  certificateValidityImpactResponseSchema,
  certificateValidityImpactSchema,
  createCertificateShareLinkSchema,
  downloadCertificateSchema,
  resetCourseCertificatesResponseSchema,
  resetCourseCertificatesSchema,
  singleCertificateSchema,
} from "./certificates.schema";
import type { CertificateArchiveReason, SupportedLanguages } from "@repo/shared";
import type { Static } from "@sinclair/typebox";
import type { ACTIVITY_LOG_ACTION_TYPES } from "src/activity-logs/types";
import type { Pagination, UUIDType } from "src/common";

export type CertificateResponse = Static<typeof certificateSchema>;
export type SingleCertificateResponse = Static<typeof singleCertificateSchema>;
export type CreateCertificateShareLinkBody = Static<typeof createCertificateShareLinkSchema>;
export type DownloadCertificateBody = Static<typeof downloadCertificateSchema>;
export type CertificateShareLinkResponse = Static<typeof certificateShareLinkResponseSchema>;
export type ResetCourseCertificatesBody = Static<typeof resetCourseCertificatesSchema>;
export type ResetCourseCertificatesResponse = Static<typeof resetCourseCertificatesResponseSchema>;
export type CertificateResetOptionsResponse = Static<typeof certificateResetOptionsResponseSchema>;
export type CertificateResetUsersResponse = Static<typeof certificateResetUsersSchema>;
export type CertificateValidityImpactBody = Static<typeof certificateValidityImpactSchema>;
export type CertificateValidityImpactResponse = Static<
  typeof certificateValidityImpactResponseSchema
>;

export type AllCertificatesResponse = Static<typeof allCertificatesSchema>;

export type CertificatesQuery = {
  userId: UUIDType;
  page?: number;
  perPage?: number;
  sort?: "createdAt";
  language: SupportedLanguages;
};

export type CertificateResetUsersQuery = {
  language?: SupportedLanguages;
  page?: number;
  perPage?: number;
  search?: string;
};

export type CertificateResetUsersResult = {
  data: CertificateResetUsersResponse;
  pagination: Pagination;
  appliedFilters: { language?: SupportedLanguages; search?: string };
};

export type FindCertificateResetUsersParams = {
  courseId: UUIDType;
  page: number;
  perPage: number;
  language?: SupportedLanguages;
  search?: string;
};

export type CertificateNotificationRecord = {
  id: UUIDType;
  userId: UUIDType;
  tenantId: UUIDType;
  courseId: UUIDType;
  userEmail: string;
  courseTitle: string | null;
};

export type CertificateExpirationWarningRecord = CertificateNotificationRecord & {
  expiresAt: string | null;
};

export type CertificateArchiveTarget = Pick<
  CertificateNotificationRecord,
  "id" | "userId" | "courseId"
>;

export type CertificateProgressResetTarget = {
  courseId: UUIDType;
  userIds: UUIDType[];
};

export type CertificateActivityRecord = Pick<
  CertificateNotificationRecord,
  "id" | "userId" | "tenantId" | "courseId" | "userEmail"
>;

export type CertificateActivityOperation =
  | typeof ACTIVITY_LOG_ACTION_TYPES.EXPIRE_CERTIFICATE
  | typeof ACTIVITY_LOG_ACTION_TYPES.RESET_CERTIFICATE;

export type CertificateActivityReason = CertificateArchiveReason;
