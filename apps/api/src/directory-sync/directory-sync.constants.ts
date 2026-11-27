import {
  DIRECTORY_SYNC_CONNECTION_STATUSES,
  DIRECTORY_SYNC_RUN_STATUSES,
  type DirectorySyncConnectionStatus,
} from "@repo/shared";

export const DIRECTORY_SYNC_ALWAYS_ALLOWED_ARCHIVE_COUNT = 5;

export const DIRECTORY_SYNC_SAFEGUARD_VIOLATIONS = {
  EMPTY_DIRECTORY: "empty_directory",
  ARCHIVE_LIMIT_EXCEEDED: "archive_limit_exceeded",
  NO_ACTIVE_ADMIN_LEFT: "no_active_admin_left",
} as const;

export const DIRECTORY_SYNC_SKIP_REASONS = {
  PROTECTED_SYNC_INITIATOR: "protected_sync_initiator",
  ARCHIVED_MANUALLY: "archived_manually",
  SUSPENDED_WITHOUT_ACCOUNT: "suspended_without_account",
  EMAIL_LINKED_TO_ANOTHER_DIRECTORY_ACCOUNT: "email_linked_to_another_directory_account",
} as const;

export const DIRECTORY_SYNC_UNFINISHED_RUN_STATUSES = [
  DIRECTORY_SYNC_RUN_STATUSES.QUEUED,
  DIRECTORY_SYNC_RUN_STATUSES.RUNNING,
];

export const DIRECTORY_SYNC_SCHEDULE_CRON_EXPRESSION = "0 */4 * * *";

export const DIRECTORY_SYNC_STALE_RUN_AFTER_MILLISECONDS = 2 * 60 * 60 * 1000;

export const DIRECTORY_SYNC_JOB_NAME = "synchronize-directory";

export const DIRECTORY_SYNC_UNFINISHED_RUN_CONSTRAINT =
  "directory_sync_runs_connection_unfinished_unique_idx";

export const POSTGRES_UNIQUE_VIOLATION_CODE = "23505";

export const DIRECTORY_SYNC_SYNCABLE_CONNECTION_STATUSES: DirectorySyncConnectionStatus[] = [
  DIRECTORY_SYNC_CONNECTION_STATUSES.ACTIVE,
  DIRECTORY_SYNC_CONNECTION_STATUSES.FAILING,
];

export const DIRECTORY_SYNC_PROGRESS_REPORT_INTERVAL = 25;

/** Development only: path to a JSON workspace that replaces Google Workspace. */
export const FAKE_DIRECTORY_FIXTURE_ENV = "DIRECTORY_SYNC_FAKE_DIRECTORY";
export const FAKE_DIRECTORY_DISABLED_ENVIRONMENTS: string[] = ["production", "staging", "test"];

export const FAKE_DIRECTORY_CLIENT_ID = "fake-directory";
