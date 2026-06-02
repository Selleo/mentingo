export const ANNOUNCEMENT_STATUSES = {
  SCHEDULED: "scheduled",
  PUBLISHED: "published",
} as const;

export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[keyof typeof ANNOUNCEMENT_STATUSES];

export const ANNOUNCEMENT_SOURCE_TYPES = {
  MANUAL: "manual",
  LIVE_TRAINING: "live_training",
  COURSE_DUE_DATE_REMINDER: "course_due_date_reminder",
} as const;

export type AnnouncementSourceType =
  (typeof ANNOUNCEMENT_SOURCE_TYPES)[keyof typeof ANNOUNCEMENT_SOURCE_TYPES];

export const ANNOUNCEMENT_EMAIL_TEMPLATES = {
  DEFAULT: "default",
  LIVE_TRAINING_REMINDER: "live_training_reminder",
  LIVE_TRAINING_STARTED: "live_training_started",
  LIVE_TRAINING_ENDED: "live_training_ended",
} as const;

export type AnnouncementEmailTemplate =
  (typeof ANNOUNCEMENT_EMAIL_TEMPLATES)[keyof typeof ANNOUNCEMENT_EMAIL_TEMPLATES];
