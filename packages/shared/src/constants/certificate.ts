// A4 landscape proportions (297mm x 210mm)
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = Math.round((SHARE_IMAGE_WIDTH * 210) / 297);

export const CERTIFICATE_STATUSES = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export const CERTIFICATE_ARCHIVE_REASONS = {
  EXPIRED: "expired",
  MANUAL_RESET: "manual_reset",
} as const;

export const CERTIFICATE_VALIDITY_TYPES = {
  PERIOD: "period",
  FIXED_DATE: "fixedDate",
} as const;

export const CERTIFICATE_VALIDITY_UNITS = {
  DAYS: "days",
  MONTHS: "months",
  YEARS: "years",
} as const;

export const CERTIFICATE_RESET_SCOPES = {
  ALL: "all",
  GROUPS: "groups",
  USERS: "users",
} as const;

export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[keyof typeof CERTIFICATE_STATUSES];
export type CertificateArchiveReason =
  (typeof CERTIFICATE_ARCHIVE_REASONS)[keyof typeof CERTIFICATE_ARCHIVE_REASONS];
export type CertificateValidityType =
  (typeof CERTIFICATE_VALIDITY_TYPES)[keyof typeof CERTIFICATE_VALIDITY_TYPES];
export type CertificateValidityUnit =
  (typeof CERTIFICATE_VALIDITY_UNITS)[keyof typeof CERTIFICATE_VALIDITY_UNITS];
export type CertificateResetScope =
  (typeof CERTIFICATE_RESET_SCOPES)[keyof typeof CERTIFICATE_RESET_SCOPES];

export type CertificateValidity =
  | {
      type: typeof CERTIFICATE_VALIDITY_TYPES.PERIOD;
      value: number;
      unit: CertificateValidityUnit;
    }
  | {
      type: typeof CERTIFICATE_VALIDITY_TYPES.FIXED_DATE;
      date: string;
    };

export type CertificateValiditySetting = CertificateValidity | null;
