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
