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

export const LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES = {
  BEFORE: "live_training_before",
  AFTER: "live_training_after",
} as const;

export type LiveTrainingResourceRelationshipType =
  (typeof LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES)[keyof typeof LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES];

export const LIVE_TRAINING_SOCKET_ROOMS = {
  LIVE_TRAINING: "live-training",
  LIVE_TRAINING_SESSION: "live-training-session",
  LIVE_TRAINING_USER: "live-training-user",
} as const;

export type LiveTrainingSocketRoom =
  (typeof LIVE_TRAINING_SOCKET_ROOMS)[keyof typeof LIVE_TRAINING_SOCKET_ROOMS];

export const LIVE_TRAINING_SOCKET_CLIENT_EVENTS = {
  SUBSCRIBE: "liveTraining:subscribe",
  UNSUBSCRIBE: "liveTraining:unsubscribe",
  SESSION_START: "liveTraining:session:start",
  SESSION_END: "liveTraining:session:end",
  PARTICIPANT_HEARTBEAT: "liveTraining:participant:heartbeat",
  PARTICIPANT_LEAVE: "liveTraining:participant:leave",
} as const;

export type LiveTrainingSocketClientEvent =
  (typeof LIVE_TRAINING_SOCKET_CLIENT_EVENTS)[keyof typeof LIVE_TRAINING_SOCKET_CLIENT_EVENTS];

export const LIVE_TRAINING_SOCKET_SERVER_EVENTS = {
  SESSION_STARTED: "liveTraining:session:started",
  SESSION_ENDED: "liveTraining:session:ended",
  SESSION_STATUS_CHANGED: "liveTraining:session:statusChanged",
  PARTICIPANT_JOINED: "liveTraining:participant:joined",
  PARTICIPANT_LEFT: "liveTraining:participant:left",
  PARTICIPANT_UPDATED: "liveTraining:participant:updated",
  ATTENDANCE_UPDATED: "liveTraining:attendance:updated",
  POPUP_AVAILABLE: "liveTraining:popup:available",
  ERROR: "liveTraining:error",
} as const;

export type LiveTrainingSocketServerEvent =
  (typeof LIVE_TRAINING_SOCKET_SERVER_EVENTS)[keyof typeof LIVE_TRAINING_SOCKET_SERVER_EVENTS];

export const LIVE_TRAINING_SOCKET_ROOM_BUILDERS = {
  liveTraining: (liveTrainingId: string) =>
    `${LIVE_TRAINING_SOCKET_ROOMS.LIVE_TRAINING}:${liveTrainingId}`,
  liveTrainingSession: (sessionId: string) =>
    `${LIVE_TRAINING_SOCKET_ROOMS.LIVE_TRAINING_SESSION}:${sessionId}`,
  liveTrainingUser: (userId: string) =>
    `${LIVE_TRAINING_SOCKET_ROOMS.LIVE_TRAINING_USER}:${userId}`,
} as const;
