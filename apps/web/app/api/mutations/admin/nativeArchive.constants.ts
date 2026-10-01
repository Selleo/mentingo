export const NATIVE_ARCHIVE_TUS_FINGERPRINT_NAMESPACE = "native-archive-tus";
export const NATIVE_ARCHIVE_QUERY_KEY = "native-archive";
export const NATIVE_ARCHIVE_STATUS_POLL_MS = 2000;
export const NATIVE_ARCHIVE_LOADER_MIN_VISIBLE_MS = 800;
export const NATIVE_ARCHIVE_DEFAULT_FILENAME = "mentingo-package.zip";

export const NATIVE_ARCHIVE_KIND = {
  COURSE: "course",
  LEARNING_PATH: "learning-path",
} as const;

export const NATIVE_ARCHIVE_JOB_STATE = {
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
