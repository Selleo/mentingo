export const CALENDAR_EVENT_SOURCE_TYPES = {
  LIVE_TRAINING: "live_training",
} as const;

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
