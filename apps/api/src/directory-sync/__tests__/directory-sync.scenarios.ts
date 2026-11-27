import { DIRECTORY_SYNC_RUN_STATUSES, SYSTEM_ROLE_SLUGS } from "@repo/shared";

export const ACCOUNT_STATES = {
  NONE: "none",
  ACTIVE_UNLINKED: "active_unlinked",
  LINKED_ACTIVE: "linked_active",
  LINKED_ARCHIVED_BY_SYNC: "linked_archived_by_sync",
  LINKED_ARCHIVED_MANUALLY: "linked_archived_manually",
} as const;

export const DIRECTORY_STATES = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  MISSING: "missing",
} as const;

export type AccountState = (typeof ACCOUNT_STATES)[keyof typeof ACCOUNT_STATES];
export type DirectoryState = (typeof DIRECTORY_STATES)[keyof typeof DIRECTORY_STATES];

export const ACCOUNT_SYNC_CASES = [
  {
    title: "creates an account for a new directory user",
    accountState: ACCOUNT_STATES.NONE,
    directoryState: DIRECTORY_STATES.ACTIVE,
    expected: {
      accountCount: 1,
      isArchived: false,
      isLinked: true,
      archivedByDirectorySync: false,
    },
  },
  {
    title: "links an existing account with the same email",
    accountState: ACCOUNT_STATES.ACTIVE_UNLINKED,
    directoryState: DIRECTORY_STATES.ACTIVE,
    expected: {
      accountCount: 1,
      isArchived: false,
      isLinked: true,
      archivedByDirectorySync: false,
    },
  },
  {
    title: "does not create an account for a suspended directory user",
    accountState: ACCOUNT_STATES.NONE,
    directoryState: DIRECTORY_STATES.SUSPENDED,
    expected: {
      accountCount: 0,
      isArchived: false,
      isLinked: false,
      archivedByDirectorySync: false,
    },
  },
  {
    title: "archives a linked account suspended in the directory",
    accountState: ACCOUNT_STATES.LINKED_ACTIVE,
    directoryState: DIRECTORY_STATES.SUSPENDED,
    expected: { accountCount: 1, isArchived: true, isLinked: true, archivedByDirectorySync: true },
  },
  {
    title: "archives a linked account that left the sync scope",
    accountState: ACCOUNT_STATES.LINKED_ACTIVE,
    directoryState: DIRECTORY_STATES.MISSING,
    expected: { accountCount: 1, isArchived: true, isLinked: true, archivedByDirectorySync: true },
  },
  {
    title: "restores an account it archived once the user is active again",
    accountState: ACCOUNT_STATES.LINKED_ARCHIVED_BY_SYNC,
    directoryState: DIRECTORY_STATES.ACTIVE,
    expected: {
      accountCount: 1,
      isArchived: false,
      isLinked: true,
      archivedByDirectorySync: false,
    },
  },
  {
    title: "keeps an account archived by an admin archived",
    accountState: ACCOUNT_STATES.LINKED_ARCHIVED_MANUALLY,
    directoryState: DIRECTORY_STATES.ACTIVE,
    expected: { accountCount: 1, isArchived: true, isLinked: true, archivedByDirectorySync: false },
  },
] as const;

export const ARCHIVE_LIMIT_CASES = [
  {
    title: "archives up to five leavers whatever the limit",
    archiveLimitPercentage: 10,
    leaverCount: 5,
    expected: { status: DIRECTORY_SYNC_RUN_STATUSES.SUCCEEDED, archivedCount: 5 },
  },
  {
    title: "archives any number of leavers when no limit is set",
    archiveLimitPercentage: null,
    leaverCount: 6,
    expected: { status: DIRECTORY_SYNC_RUN_STATUSES.SUCCEEDED, archivedCount: 6 },
  },
  {
    title: "stops the run when it would archive more users than the limit allows",
    archiveLimitPercentage: 10,
    leaverCount: 6,
    expected: { status: DIRECTORY_SYNC_RUN_STATUSES.ABORTED_BY_SAFEGUARD, archivedCount: 0 },
  },
] as const;

export const UNFINISHED_RUN_STATUS_CASES = [
  { runStatus: DIRECTORY_SYNC_RUN_STATUSES.QUEUED },
  { runStatus: DIRECTORY_SYNC_RUN_STATUSES.RUNNING },
] as const;

export const SCHEDULE_CASES = [
  {
    title: "does not schedule a connection before its first successful sync",
    lastSuccessfulSyncAt: null,
    expectedScheduledRunCount: 0,
  },
  {
    title: "schedules a connection after its first successful sync",
    lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z",
    expectedScheduledRunCount: 1,
  },
] as const;

export const DIRECTORY_SYNC_TABLES = [
  "outbox_events",
  "activity_logs",
  "directory_sync_runs",
  "directory_sync_group_mappings",
  "directory_sync_role_mappings",
  "user_external_identities",
  "directory_sync_connections",
  "group_users",
  "groups",
  "settings",
  "users",
] as const;

export const SYNCED_USER_EMAIL = "anna@workspace.test";
export const SYNCED_USER_EXTERNAL_ID = "google-user-anna";
export const GOOGLE_ADMINS_GROUP_ID = "google-group-admins";
export const GOOGLE_CREATORS_GROUP_ID = "google-group-creators";
export const GOOGLE_SALES_GROUP_ID = "google-group-sales";
export const RUN_COMPLETION_TIMEOUT_MILLISECONDS = 15_000;
export const RUN_POLL_INTERVAL_MILLISECONDS = 200;
export const SYNC_STARTER_PASSWORD = "Password123!";
export const LAST_ACTIVE_ADMIN_ERROR_KEY = "adminUsersView.toast.lastActiveAdminRequired";
export const RENAMED_SYNCED_USER_EMAIL = "anna.renamed@workspace.test";
export const STALE_RUN_AGE_MILLISECONDS = 3 * 60 * 60 * 1000;

export const ROLE_OVERRIDE_RESTORE_CASES = [
  {
    title: "restores directory roles when a user manager asks over HTTP",
    requesterRoleSlug: SYSTEM_ROLE_SLUGS.ADMIN,
    expected: { status: 204, rolesOverridden: false },
  },
  {
    title: "refuses to restore directory roles for a user without user management",
    requesterRoleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
    expected: { status: 403, rolesOverridden: true },
  },
] as const;

export const REUSED_EMAIL_EXTERNAL_ID = "google-user-new-anna";

export const RENAMED_USER_SIGN_IN_CASES = [
  {
    title: "signs a user renamed in Google in to their account when registration is invite only",
    inviteOnlyRegistration: true,
  },
  {
    title: "signs a user renamed in Google in to their account instead of registering a second one",
    inviteOnlyRegistration: false,
  },
] as const;

export const DIRECTORY_CONFIGURATION_REQUESTS = {
  CONNECTION_SETTINGS: "connection_settings",
  ROLE_MAPPINGS: "role_mappings",
  MANUAL_SYNC: "manual_sync",
} as const;

export type DirectoryConfigurationRequest =
  (typeof DIRECTORY_CONFIGURATION_REQUESTS)[keyof typeof DIRECTORY_CONFIGURATION_REQUESTS];

export const DIRECTORY_CONFIGURATION_WITHOUT_USER_MANAGEMENT_CASES = [
  {
    title: "refuses to change the default role without user management",
    configurationRequest: DIRECTORY_CONFIGURATION_REQUESTS.CONNECTION_SETTINGS,
  },
  {
    title: "refuses to map directory groups to roles without user management",
    configurationRequest: DIRECTORY_CONFIGURATION_REQUESTS.ROLE_MAPPINGS,
  },
  {
    title: "refuses to start a sync without user management",
    configurationRequest: DIRECTORY_CONFIGURATION_REQUESTS.MANUAL_SYNC,
  },
] as const;
