export const LEARNING_PATH_STATUSES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  PRIVATE: "private",
} as const;

export type LearningPathStatus =
  (typeof LEARNING_PATH_STATUSES)[keyof typeof LEARNING_PATH_STATUSES];

export const LEARNING_PATH_ENROLLMENT_TYPES = {
  DIRECT: "direct",
  GROUP: "group",
} as const;

export type LearningPathEnrollmentType =
  (typeof LEARNING_PATH_ENROLLMENT_TYPES)[keyof typeof LEARNING_PATH_ENROLLMENT_TYPES];

export const LEARNING_PATH_PROGRESS_STATUSES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

export type LearningPathProgressStatus =
  (typeof LEARNING_PATH_PROGRESS_STATUSES)[keyof typeof LEARNING_PATH_PROGRESS_STATUSES];

export const LEARNING_PATH_ENTITY_TYPES = {
  LEARNING_PATH: "learning_path",
  COURSE: "course",
} as const;

export type LearningPathEntityType =
  (typeof LEARNING_PATH_ENTITY_TYPES)[keyof typeof LEARNING_PATH_ENTITY_TYPES];

export const LEARNING_PATH_CERTIFICATE_STATUSES = {
  ACTIVE: "active",
  EXPIRED: "expired",
} as const;

export type LearningPathCertificateStatus =
  (typeof LEARNING_PATH_CERTIFICATE_STATUSES)[keyof typeof LEARNING_PATH_CERTIFICATE_STATUSES];
