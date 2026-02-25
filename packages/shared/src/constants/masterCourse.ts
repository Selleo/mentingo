export const COURSE_ORIGIN_TYPES = {
  REGULAR: "regular",
  MASTER: "master",
  EXPORTED: "exported",
} as const;

export type CourseOriginType = (typeof COURSE_ORIGIN_TYPES)[keyof typeof COURSE_ORIGIN_TYPES];

export const MASTER_COURSE_EXPORT_SYNC_STATUSES = {
  ACTIVE: "active",
  FAILED: "failed",
  PAUSED: "paused",
} as const;

export type MasterCourseExportSyncStatus =
  (typeof MASTER_COURSE_EXPORT_SYNC_STATUSES)[keyof typeof MASTER_COURSE_EXPORT_SYNC_STATUSES];

export const MASTER_COURSE_ENTITY_TYPES = {
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
  QUESTION: "question",
  OPTION: "option",
  RESOURCE: "resource",
  RESOURCE_ENTITY: "resource_entity",
  AI_MENTOR_LESSON: "ai_mentor_lesson",
} as const;

export type MasterCourseEntityType =
  (typeof MASTER_COURSE_ENTITY_TYPES)[keyof typeof MASTER_COURSE_ENTITY_TYPES];
