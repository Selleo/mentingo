export const COURSE_GENERATION_SYNC_STATUS = {
  NOT_STARTED: "not_started",
  PROCESSING: "processing",
  FAILED: "failed",
  PROCESSED: "processed",
  DISMISSED: "dismissed",
} as const;

export type CourseGenerationSyncStatus =
  (typeof COURSE_GENERATION_SYNC_STATUS)[keyof typeof COURSE_GENERATION_SYNC_STATUS];
