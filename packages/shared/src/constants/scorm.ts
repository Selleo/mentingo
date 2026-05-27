export const SCORM_STANDARD = {
  SCORM_1_2: "scorm_1_2",
  SCORM_2004: "scorm_2004",
} as const;

export type ScormStandard = (typeof SCORM_STANDARD)[keyof typeof SCORM_STANDARD];

export const SCORM_PACKAGE_ENTITY_TYPE = {
  COURSE: "course",
  LESSON: "lesson",
} as const;

export type ScormPackageEntityType =
  (typeof SCORM_PACKAGE_ENTITY_TYPE)[keyof typeof SCORM_PACKAGE_ENTITY_TYPE];

export const SCORM_PACKAGE_STATUS = {
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
} as const;

export type ScormPackageStatus = (typeof SCORM_PACKAGE_STATUS)[keyof typeof SCORM_PACKAGE_STATUS];

export const SCORM_IMPORT_ACTION = {
  CREATE_COURSE: "create-course",
  CREATE_LESSON: "create-lesson",
  ATTACH_LESSON_PACKAGE: "attach-lesson-package",
} as const;

export type ScormImportAction = (typeof SCORM_IMPORT_ACTION)[keyof typeof SCORM_IMPORT_ACTION];

export const SCORM_IMPORT_SOCKET = {
  EVENTS: {
    STATUS_CHANGED: "scorm-import-status-change",
  },
  MESSAGE_KEYS: {
    PROCESSING: "adminScorm.importProcessing.description",
    READY: "adminScorm.importSuccess.description",
    FAILED_COURSE: "adminScorm.importFailure.courseDescription",
    FAILED_LESSON: "adminScorm.importFailure.lessonDescription",
  },
} as const;

export const SCORM_COMPLETION_STATUS = {
  COMPLETED: "completed",
  INCOMPLETE: "incomplete",
  NOT_ATTEMPTED: "not_attempted",
  UNKNOWN: "unknown",
} as const;

export type ScormCompletionStatus =
  (typeof SCORM_COMPLETION_STATUS)[keyof typeof SCORM_COMPLETION_STATUS];

export const SCORM_SUCCESS_STATUS = {
  PASSED: "passed",
  FAILED: "failed",
  UNKNOWN: "unknown",
} as const;

export type ScormSuccessStatus = (typeof SCORM_SUCCESS_STATUS)[keyof typeof SCORM_SUCCESS_STATUS];
