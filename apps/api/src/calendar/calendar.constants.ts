export const SYNC_HISTORY_DAYS = 30;
export const SYNC_HORIZON_MONTHS = 6;
export const WINDOW_REBUILD_AFTER_DAYS = 28;
export const MANUAL_SYNC_COOLDOWN_MS = 60_000;
export const SUBSCRIPTION_LIFETIME_DAYS = 6;
export const SUBSCRIPTION_RENEWAL_WINDOW_MS = 48 * 60 * 60 * 1000;

export const MICROSOFT_CALENDAR_OAUTH_RESULTS = {
  CONNECTED: "connected",
  REPLACEMENT_REQUIRED: "replacement_required",
  AUTHORIZATION_FAILED: "authorization_failed",
  ADMIN_APPROVAL_REQUIRED: "admin_approval_required",
} as const;

export const MICROSOFT_CALENDAR_OUTBOUND_ERROR_CODES = {
  AUTHORIZATION_EXPIRED: "authorization_expired",
  EXPORT_FAILED: "export_failed",
} as const;

export const MICROSOFT_CALENDAR_OUTBOUND_SOURCE_TYPES = {
  LIVE_TRAINING: "live_training",
  COURSE_DUE_DATE: "course_due_date",
} as const;
