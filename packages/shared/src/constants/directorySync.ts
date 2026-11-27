export const DIRECTORY_SYNC_PROVIDERS = {
  GOOGLE_WORKSPACE: "google_workspace",
} as const;

export type DirectorySyncProvider =
  (typeof DIRECTORY_SYNC_PROVIDERS)[keyof typeof DIRECTORY_SYNC_PROVIDERS];

export const DIRECTORY_SYNC_CONNECTION_STATUSES = {
  PENDING_VERIFICATION: "pending_verification",
  ACTIVE: "active",
  FAILING: "failing",
} as const;

export type DirectorySyncConnectionStatus =
  (typeof DIRECTORY_SYNC_CONNECTION_STATUSES)[keyof typeof DIRECTORY_SYNC_CONNECTION_STATUSES];

export const DIRECTORY_SYNC_SCOPE_TYPES = {
  ALL_USERS: "all_users",
  ORGANIZATIONAL_UNITS: "organizational_units",
  GROUPS: "groups",
} as const;

export type DirectorySyncScopeType =
  (typeof DIRECTORY_SYNC_SCOPE_TYPES)[keyof typeof DIRECTORY_SYNC_SCOPE_TYPES];

export const DIRECTORY_SYNC_RUN_STATUSES = {
  QUEUED: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  ABORTED_BY_SAFEGUARD: "aborted_by_safeguard",
} as const;

export type DirectorySyncRunStatus =
  (typeof DIRECTORY_SYNC_RUN_STATUSES)[keyof typeof DIRECTORY_SYNC_RUN_STATUSES];

export const DIRECTORY_SYNC_RUN_TRIGGERS = {
  SCHEDULE: "schedule",
  MANUAL: "manual",
} as const;

export type DirectorySyncRunTrigger =
  (typeof DIRECTORY_SYNC_RUN_TRIGGERS)[keyof typeof DIRECTORY_SYNC_RUN_TRIGGERS];

export const DIRECTORY_SYNC_ERROR_KEYS = {
  INVALID_SERVICE_ACCOUNT_KEY: "directorySync.errors.invalidServiceAccountKey",
  SYNC_ALREADY_IN_PROGRESS: "directorySync.errors.syncAlreadyInProgress",
  DISCONNECT_WHILE_SYNCING: "directorySync.errors.disconnectWhileSyncing",
  CONNECTION_NOT_ACTIVE: "directorySync.errors.connectionNotActive",
  CONNECTION_NOT_FOUND: "directorySync.errors.connectionNotFound",
  SERVICE_ACCOUNT_KEY_MISSING: "directorySync.errors.serviceAccountKeyMissing",
  DIRECTORY_ACCESS_DENIED: "directorySync.errors.directoryAccessDenied",
  SCOPE_NOT_FOUND: "directorySync.errors.scopeNotFound",
  INVALID_SCOPE: "directorySync.errors.invalidScope",
  INVALID_ROLE: "directorySync.errors.invalidRole",
  DUPLICATE_ROLE_MAPPING: "directorySync.errors.duplicateRoleMapping",
  DUPLICATE_GROUP_MAPPING: "directorySync.errors.duplicateGroupMapping",
  INVALID_GROUP: "directorySync.errors.invalidGroup",
  GROUP_MEMBERSHIP_MANAGED_BY_DIRECTORY: "directorySync.errors.groupMembershipManagedByDirectory",
  MAPPED_GROUP_NOT_DELETABLE: "directorySync.errors.mappedGroupNotDeletable",
  DIRECTORY_USER_NOT_DELETABLE: "directorySync.errors.directoryUserNotDeletable",
  USER_NOT_SYNCED: "directorySync.errors.userNotSynced",
} as const;

export const DIRECTORY_SYNC_ARCHIVE_LIMIT_PERCENTAGE = {
  MIN: 1,
  MAX: 100,
} as const;

export const DIRECTORY_SYNC_CHANGE_SOURCE = "directory_sync";
