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

export const MICROSOFT_CALENDAR_OUTBOUND_SOURCE_TYPES = {
  LIVE_TRAINING: "live_training",
  COURSE_DUE_DATE: "course_due_date",
} as const;

export type MicrosoftCalendarOutboundErrorCode =
  (typeof MICROSOFT_CALENDAR_OUTBOUND_ERROR_CODES)[keyof typeof MICROSOFT_CALENDAR_OUTBOUND_ERROR_CODES];
export type MicrosoftCalendarOutboundSourceType =
  (typeof MICROSOFT_CALENDAR_OUTBOUND_SOURCE_TYPES)[keyof typeof MICROSOFT_CALENDAR_OUTBOUND_SOURCE_TYPES];

export const MICROSOFT_CALENDAR_NAME = "Mentingo";
export const MICROSOFT_CALENDAR_DEFAULT_MARKER_PROPERTY =
  "String {8f1c0f91-9f8a-4f2e-9e2e-4c454e54494e} Name MentingoManaged";

export const MICROSOFT_CALENDAR_LIFECYCLE_EVENTS = {
  MISSED: "missed",
  REAUTHORIZATION_REQUIRED: "reauthorizationRequired",
  SUBSCRIPTION_REMOVED: "subscriptionRemoved",
} as const;

export const MICROSOFT_CALENDAR_GRAPH_SHOW_AS = {
  FREE: "free",
  TENTATIVE: "tentative",
  BUSY: "busy",
  OUT_OF_OFFICE: "oof",
  WORKING_ELSEWHERE: "workingElsewhere",
  UNKNOWN: "unknown",
} as const;

export const MICROSOFT_CALENDAR_GRAPH_SENSITIVITIES = {
  NORMAL: "normal",
  PERSONAL: "personal",
  PRIVATE: "private",
  CONFIDENTIAL: "confidential",
  UNKNOWN: "unknown",
} as const;

export const MICROSOFT_CALENDAR_OAUTH_PURPOSE = "microsoft_calendar";
export const MICROSOFT_CALENDAR_OUTBOUND_ERROR_CODES = {
  AUTHORIZATION_EXPIRED: "authorization_expired",
  EXPORT_FAILED: "export_failed",
  CALENDAR_DELETED: "calendar_deleted",
} as const;
