export const ACTIVITY_LOG_ACTION_TYPES = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  ENROLL_COURSE: "enroll_course",
  UNENROLL_COURSE: "unenroll_course",
  COMPLETE_LESSON: "complete_lesson",
  COMPLETE_COURSE: "complete_course",
  COMPLETE_CHAPTER: "complete_chapter",
  VIEW_ANNOUNCEMENT: "view_announcement",
} as const;

export type ActivityLogActionType =
  (typeof ACTIVITY_LOG_ACTION_TYPES)[keyof typeof ACTIVITY_LOG_ACTION_TYPES];

export const ACTIVITY_LOG_RESOURCE_TYPES = {
  USER: "user",
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
  ANNOUNCEMENT: "announcement",
  GROUP: "group",
  SETTINGS: "settings",
  INTEGRATION: "integration",
} as const;

export type ActivityLogResourceType =
  (typeof ACTIVITY_LOG_RESOURCE_TYPES)[keyof typeof ACTIVITY_LOG_RESOURCE_TYPES];

export type ActivityLogMetadata = {
  operation: ActivityLogActionType;
  changedFields?: string[];
  before?: Record<string, string> | null;
  after?: Record<string, string> | null;
  context?: Record<string, string> | null;
};
