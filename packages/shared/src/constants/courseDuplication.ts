export const COURSE_DUPLICATION_STATUS = {
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type CourseDuplicationStatus =
  (typeof COURSE_DUPLICATION_STATUS)[keyof typeof COURSE_DUPLICATION_STATUS];

export const COURSE_DUPLICATION_SOCKET = {
  EVENTS: {
    STATUS_CHANGED: "course-duplication-status-change",
  },
  MESSAGE_KEYS: {
    PROCESSING: "adminCourseDuplication.processing",
    COMPLETED: "adminCourseDuplication.completed",
    FAILED: "adminCourseDuplication.failed",
  },
} as const;
