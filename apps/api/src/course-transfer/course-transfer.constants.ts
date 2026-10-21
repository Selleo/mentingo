import { LEARNING_PATH_ERRORS } from "src/learning-path/constants/learning-path.errors";
import { QUEUE_NAMES } from "src/queue/queue.types";

export const COURSE_TRANSFER_KINDS = {
  COURSE: "course",
  LEARNING_PATH: "learning-path",
} as const;

export const COURSE_TRANSFER_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  WAITING_FOR_DEPENDENCIES: "waiting-for-dependencies",
  COMPLETED: "completed",
  FAILED: "failed",
  SUPERSEDED: "superseded",
} as const;

export const COURSE_TRANSFER_ERROR_CODES = {
  TRANSFER_FAILED: "transfer-failed",
  RELATIONSHIP_PAUSED: "relationship-paused",
  RELATIONSHIP_MISSING: "relationship-missing",
  DEPENDENCY_FAILED: "dependency-failed",
} as const;

export const COURSE_TRANSFER_DEPENDENCY_STATES = {
  APPLIED: "applied",
  PENDING: "pending",
  FAILED: "failed",
} as const;

export const COURSE_TRANSFER_CLAIM_OUTCOMES = {
  LEASED: "leased",
  ALREADY_APPLIED: "already-applied",
  WAITING_FOR_DEPENDENCIES: "waiting-for-dependencies",
} as const;

export const COURSE_TRANSFER_MODES = {
  SYNC: "sync",
  ARCHIVE_SYNC: "archive-sync",
  DUPLICATE: "duplicate",
} as const;

export const COURSE_TRANSFER_ENTITY_MAP_SCOPES = {
  EXPORT: "export",
  ARCHIVE_COURSE: "archive-course",
} as const;

export const COURSE_TRANSFER_RESOURCE_REFERENCE_KINDS = {
  EXTERNAL: "external",
  INTERNAL: "internal",
} as const;

export const COURSE_TRANSFER_RESOURCE_GROUPS = {
  COURSES: "courses",
  CHAPTERS: "chapters",
  LESSONS: "lessons",
  QUESTIONS: "questions",
} as const;

export const COURSE_TRANSFER_JOB_STATES = {
  WAITING: "waiting",
  ACTIVE: "active",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export const COURSE_TRANSFER_JOB_TARGETS = {
  [COURSE_TRANSFER_KINDS.COURSE]: {
    queueName: QUEUE_NAMES.MASTER_COURSE_SYNC,
    jobName: "master-course-sync",
    sourceIdKey: "sourceCourseId",
  },
  [COURSE_TRANSFER_KINDS.LEARNING_PATH]: {
    queueName: QUEUE_NAMES.LEARNING_PATH_SYNC,
    jobName: "learning-path-sync",
    sourceIdKey: "sourceLearningPathId",
  },
} as const;

export const COURSE_TRANSFER_RELATIONSHIP_ERRORS = {
  [COURSE_TRANSFER_KINDS.COURSE]: {
    missing: "masterCourse.error.exportLinkMissing",
    invalidJob: "masterCourse.error.exportLinkMissing",
    paused: "masterCourse.error.exportPaused",
  },
  [COURSE_TRANSFER_KINDS.LEARNING_PATH]: {
    missing: LEARNING_PATH_ERRORS.EXPORT_LINK_MISSING,
    invalidJob: LEARNING_PATH_ERRORS.EXPORT_JOB_DATA_INVALID,
    paused: "masterCourse.error.exportPaused",
  },
} as const;

export const COURSE_TRANSFER_TRIGGERS = {
  EXPORT: "export",
  LEARNING_PATH: "learning-path",
} as const;

export const COURSE_TRANSFER_CANDIDATES_PAGE_SIZE = 10;

export const COURSE_TRANSFER_LEASE_SECONDS = 120;
export const COURSE_TRANSFER_HEARTBEAT_MS = 20_000;
export const COURSE_TRANSFER_RECOVERY_SECONDS = 300;
export const COURSE_TRANSFER_MAX_ATTEMPTS = 5;

export const COURSE_TRANSFER_SCORM_COPY_BATCH_SIZE = 5;
export const COURSE_TRANSFER_SCORM_PACKAGE_UUID_NAMESPACE = "8e3a79d8-0d25-4d4d-8b33-7d44c32c9f10";
