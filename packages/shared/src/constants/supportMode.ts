export const SUPPORT_SESSION_STATUSES = {
  PENDING: "pending",
  ACTIVE: "active",
  REVOKED: "revoked",
} as const;

export const SUPPORT_USER_SCOPES = {
  ADMINS: "admins",
  ALL: "all",
} as const;

export type SupportUserScope = (typeof SUPPORT_USER_SCOPES)[keyof typeof SUPPORT_USER_SCOPES];

export type SupportSessionStatus =
  (typeof SUPPORT_SESSION_STATUSES)[keyof typeof SUPPORT_SESSION_STATUSES];
