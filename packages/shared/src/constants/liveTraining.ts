export const CALENDAR_EVENT_STATUSES = {
  SCHEDULED: "scheduled",
  CANCELLED: "cancelled",
  ENDED: "ended",
  EXPIRED: "expired",
} as const;

export type CalendarEventStatus =
  (typeof CALENDAR_EVENT_STATUSES)[keyof typeof CALENDAR_EVENT_STATUSES];

export const LIVE_TRAINING_DELIVERY_TYPES = {
  ONLINE: "online",
  OFFLINE: "offline",
} as const;

export type LiveTrainingDeliveryType =
  (typeof LIVE_TRAINING_DELIVERY_TYPES)[keyof typeof LIVE_TRAINING_DELIVERY_TYPES];

export const LIVE_TRAINING_VISIBILITY_SCOPES = {
  ALL: "all",
  LINKED_COURSES: "linked_courses",
} as const;

export type LiveTrainingVisibilityScope =
  (typeof LIVE_TRAINING_VISIBILITY_SCOPES)[keyof typeof LIVE_TRAINING_VISIBILITY_SCOPES];

export const LIVE_TRAINING_STATUSES = {
  SCHEDULED: "scheduled",
  ACTIVE: "active",
  ENDED: "ended",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

export type LiveTrainingStatus =
  (typeof LIVE_TRAINING_STATUSES)[keyof typeof LIVE_TRAINING_STATUSES];

export const LIVE_TRAINING_SESSION_STATUSES = {
  WAITING: "waiting",
  ACTIVE: "active",
  ENDED: "ended",
  FAILED: "failed",
} as const;

export type LiveTrainingSessionStatus =
  (typeof LIVE_TRAINING_SESSION_STATUSES)[keyof typeof LIVE_TRAINING_SESSION_STATUSES];

export const LIVE_TRAINING_MEMBER_ROLES = {
  TRAINER: "trainer",
  CO_TRAINER: "co_trainer",
  MODERATOR: "moderator",
  OBSERVER: "observer",
} as const;

export type LiveTrainingMemberRole =
  (typeof LIVE_TRAINING_MEMBER_ROLES)[keyof typeof LIVE_TRAINING_MEMBER_ROLES];

export const LIVE_TRAINING_PARTICIPANT_ROLES = {
  ...LIVE_TRAINING_MEMBER_ROLES,
  ADMIN: "admin",
} as const;

export type LiveTrainingParticipantRole =
  (typeof LIVE_TRAINING_PARTICIPANT_ROLES)[keyof typeof LIVE_TRAINING_PARTICIPANT_ROLES];

export const LIVE_TRAINING_LINK_ENTITY_TYPES = {
  COURSE: "course",
} as const;

export type LiveTrainingLinkEntityType =
  (typeof LIVE_TRAINING_LINK_ENTITY_TYPES)[keyof typeof LIVE_TRAINING_LINK_ENTITY_TYPES];
