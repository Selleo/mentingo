import { CALENDAR_PROVIDERS } from "@repo/shared";

import type { CalendarProvider } from "@repo/shared";

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

export const CALENDAR_OUTBOUND_SOURCE_TYPES = {
  LIVE_TRAINING: "live_training",
  COURSE_DUE_DATE: "course_due_date",
} as const;

export const MICROSOFT_CALENDAR_OUTBOUND_SOURCE_TYPES = CALENDAR_OUTBOUND_SOURCE_TYPES;

export const CALENDAR_OUTBOUND_ERROR_CODES = {
  AUTHORIZATION_EXPIRED: "authorization_expired",
  EXPORT_FAILED: "export_failed",
  CALENDAR_DELETED: "calendar_deleted",
} as const;

export const MICROSOFT_CALENDAR_OUTBOUND_ERROR_CODES = CALENDAR_OUTBOUND_ERROR_CODES;

export const CALENDAR_SYNC_ERROR_CODES = {
  AUTHORIZATION_EXPIRED: "authorization_expired",
  SYNC_FAILED: "sync_failed",
} as const;

export const MICROSOFT_CALENDAR_SYNC_ERROR_CODES = CALENDAR_SYNC_ERROR_CODES;

export type CalendarOutboundErrorCode =
  (typeof CALENDAR_OUTBOUND_ERROR_CODES)[keyof typeof CALENDAR_OUTBOUND_ERROR_CODES];
export type CalendarOutboundSourceType =
  (typeof CALENDAR_OUTBOUND_SOURCE_TYPES)[keyof typeof CALENDAR_OUTBOUND_SOURCE_TYPES];

export type MicrosoftCalendarOutboundErrorCode = CalendarOutboundErrorCode;
export type MicrosoftCalendarOutboundSourceType = CalendarOutboundSourceType;

export const MANAGED_CALENDAR_NAME = "Mentingo";
export const MICROSOFT_CALENDAR_NAME = MANAGED_CALENDAR_NAME;
export const MICROSOFT_CALENDAR_DEFAULT_MARKER_PROPERTY =
  "String {8f1c0f91-9f8a-4f2e-9e2e-4c454e54494e} Name MentingoManaged";

export const EXTERNAL_CALENDAR_EVENT_UID_PREFIXES: Record<CalendarProvider, string> = {
  [CALENDAR_PROVIDERS.MICROSOFT]: "microsoft-outlook",
  [CALENDAR_PROVIDERS.GOOGLE]: "google-calendar",
};

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

export const GOOGLE_CALENDAR_OAUTH_PURPOSE = "google_calendar";

export const GOOGLE_CALENDAR_PRIMARY_CALENDAR_ID = "primary";

export const GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY = "mentingoManaged";

export const GOOGLE_CALENDAR_EVENT_STATUSES = {
  CONFIRMED: "confirmed",
  TENTATIVE: "tentative",
  CANCELLED: "cancelled",
} as const;

export const GOOGLE_CALENDAR_EVENT_VISIBILITIES = {
  DEFAULT: "default",
  PUBLIC: "public",
  PRIVATE: "private",
  CONFIDENTIAL: "confidential",
} as const;

export const GOOGLE_CALENDAR_EVENT_TRANSPARENCIES = {
  OPAQUE: "opaque",
  TRANSPARENT: "transparent",
} as const;

export const GOOGLE_CALENDAR_RESOURCE_STATES = {
  SYNC: "sync",
  EXISTS: "exists",
  NOT_EXISTS: "not_exists",
} as const;
