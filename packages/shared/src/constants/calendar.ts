export const CALENDAR_EVENT_SOURCE_TYPES = {
  LIVE_TRAINING: "live_training",
  COURSE_DUE_DATE: "course_due_date",
  MICROSOFT_OUTLOOK: "microsoft_outlook",
} as const;

export const CALENDAR_PROVIDERS = {
  MICROSOFT: "microsoft",
} as const;

export const MICROSOFT_CALENDAR_OAUTH_RESULTS = {
  CONNECTED: "connected",
  REPLACEMENT_REQUIRED: "replacement_required",
  AUTHORIZATION_FAILED: "authorization_failed",
  ADMIN_APPROVAL_REQUIRED: "admin_approval_required",
} as const;

export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[keyof typeof CALENDAR_PROVIDERS];

export type CalendarEventSourceType =
  (typeof CALENDAR_EVENT_SOURCE_TYPES)[keyof typeof CALENDAR_EVENT_SOURCE_TYPES];

export const CALENDAR_EVENT_SOURCE_ROLES = {
  ADMIN: "admin",
  AUTHOR: "author",
  TRAINER: "trainer",
  OBSERVER: "observer",
} as const;

export type CalendarEventSourceRole =
  (typeof CALENDAR_EVENT_SOURCE_ROLES)[keyof typeof CALENDAR_EVENT_SOURCE_ROLES];

export const MICROSOFT_CALENDAR_CONNECTION_STATUSES = {
  SYNCING: "syncing",
  CONNECTED: "connected",
  ERROR: "error",
  RECONNECT_REQUIRED: "reconnect_required",
} as const;

export const MICROSOFT_CALENDAR_OUTBOUND_STATUSES = {
  DISABLED: "disabled",
  QUEUED: "queued",
  SYNCING: "syncing",
  CONNECTED: "connected",
  ERROR: "error",
} as const;

export type MicrosoftCalendarOutboundStatus =
  (typeof MICROSOFT_CALENDAR_OUTBOUND_STATUSES)[keyof typeof MICROSOFT_CALENDAR_OUTBOUND_STATUSES];

export type MicrosoftCalendarConnectionStatus =
  (typeof MICROSOFT_CALENDAR_CONNECTION_STATUSES)[keyof typeof MICROSOFT_CALENDAR_CONNECTION_STATUSES];

export const MICROSOFT_CALENDAR_PUBLIC_STATUSES = {
  DISCONNECTED: "disconnected",
  ...MICROSOFT_CALENDAR_CONNECTION_STATUSES,
} as const;

export type MicrosoftCalendarPublicStatus =
  (typeof MICROSOFT_CALENDAR_PUBLIC_STATUSES)[keyof typeof MICROSOFT_CALENDAR_PUBLIC_STATUSES];

export const OUTLOOK_EVENT_AVAILABILITIES = {
  FREE: "free",
  TENTATIVE: "tentative",
  BUSY: "busy",
  OUT_OF_OFFICE: "out_of_office",
  WORKING_ELSEWHERE: "working_elsewhere",
} as const;

export type OutlookEventAvailability =
  (typeof OUTLOOK_EVENT_AVAILABILITIES)[keyof typeof OUTLOOK_EVENT_AVAILABILITIES];

export const OUTLOOK_EVENT_SENSITIVITIES = {
  NORMAL: "normal",
  PERSONAL: "personal",
  PRIVATE: "private",
  CONFIDENTIAL: "confidential",
} as const;

export type OutlookEventSensitivity =
  (typeof OUTLOOK_EVENT_SENSITIVITIES)[keyof typeof OUTLOOK_EVENT_SENSITIVITIES];
