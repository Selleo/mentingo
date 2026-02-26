export const SUPPORT_SESSION_STATUSES = {
  PENDING: "pending",
  ACTIVE: "active",
  REVOKED: "revoked",
} as const;

export type SupportSessionStatus =
  (typeof SUPPORT_SESSION_STATUSES)[keyof typeof SUPPORT_SESSION_STATUSES];
