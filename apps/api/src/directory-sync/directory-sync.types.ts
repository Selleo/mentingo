import type {
  DIRECTORY_SYNC_SAFEGUARD_VIOLATIONS,
  DIRECTORY_SYNC_SKIP_REASONS,
} from "./directory-sync.constants";
import type { DirectorySyncScopeType } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type DirectorySyncSafeguardViolation =
  (typeof DIRECTORY_SYNC_SAFEGUARD_VIOLATIONS)[keyof typeof DIRECTORY_SYNC_SAFEGUARD_VIOLATIONS];

export type DirectorySyncSkipReason =
  (typeof DIRECTORY_SYNC_SKIP_REASONS)[keyof typeof DIRECTORY_SYNC_SKIP_REASONS];

export type DirectoryUser = {
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuspended: boolean;
  groupExternalIds: string[];
};

export type DirectoryRoleMapping = {
  externalGroupId: string;
  roleSlug: string;
  priority: number;
};

export type LinkedDirectoryAccount = {
  userId: UUIDType;
  externalId: string;
  isArchived: boolean;
  archivedByDirectorySync: boolean;
  rolesOverridden: boolean;
  roleSlugs: string[];
};

export type DirectoryEmailMatchCandidate = {
  userId: UUIDType;
  email: string;
  isArchived: boolean;
  linkedExternalId: string | null;
  roleSlugs: string[];
};

export type DirectoryReconciliationInput = {
  directoryUsers: DirectoryUser[];
  linkedAccounts: LinkedDirectoryAccount[];
  emailMatchCandidates: DirectoryEmailMatchCandidate[];
  roleMappings: DirectoryRoleMapping[];
  defaultRoleSlug: string;
  archiveUsersOutsideScope: boolean;
  protectedUserIds: UUIDType[];
};

export type DirectoryAccountToCreate = {
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleSlug: string;
};

export type DirectoryAccountToLink = {
  userId: UUIDType;
  externalId: string;
};

export type DirectoryRoleChange = {
  userId: UUIDType;
  roleSlug: string;
};

export type SkippedDirectoryAccount = {
  externalId: string;
  userId: UUIDType | null;
  reason: DirectorySyncSkipReason;
};

export type DirectoryReconciliationPlan = {
  accountsToCreate: DirectoryAccountToCreate[];
  accountsToLink: DirectoryAccountToLink[];
  roleChanges: DirectoryRoleChange[];
  userIdsToArchive: UUIDType[];
  userIdsToRestore: UUIDType[];
  userIdsToMarkRolesOverridden: UUIDType[];
  skippedAccounts: SkippedDirectoryAccount[];
};

export type DirectorySyncSafeguardInput = {
  plan: DirectoryReconciliationPlan;
  directoryUserCount: number;
  activeLinkedAccountCount: number;
  archiveLimitPercentage: number | null;
  activeAdminUserIds: UUIDType[];
  adminRoleSlug: string;
};

export type DirectoryConnectionContext = {
  administratorEmail: string;
  directoryCustomerId: string;
  scopeType: DirectorySyncScopeType;
  scopeExternalIds: string[];
};

export type DirectoryAccessVerification = {
  directoryCustomerId: string;
};

export type DirectoryOrganizationalUnit = {
  externalId: string;
  path: string;
  name: string;
};

export type DirectoryGroup = {
  externalId: string;
  email: string;
  name: string;
};

export type DirectoryProviderSetupDetails = {
  clientId: string;
  scopes: string[];
};

export interface DirectoryProviderClient {
  getSetupDetails(): Promise<DirectoryProviderSetupDetails>;
  verifyDirectoryAccess(administratorEmail: string): Promise<DirectoryAccessVerification>;
  listDirectoryUsersInScope(
    connection: DirectoryConnectionContext,
    trackedGroupIds: string[],
    reportProgress: () => Promise<void>,
  ): Promise<DirectoryUser[]>;
  listOrganizationalUnits(
    connection: DirectoryConnectionContext,
  ): Promise<DirectoryOrganizationalUnit[]>;
  searchDirectoryGroups(
    connection: DirectoryConnectionContext,
    searchPhrase: string,
  ): Promise<DirectoryGroup[]>;
}

export type DirectoryPlanWriteSummary = {
  createdUsersCount: number;
  linkedUsersCount: number;
  roleChangedUsersCount: number;
  archivedUsersCount: number;
  restoredUsersCount: number;
  failedUsersCount: number;
};

export type DirectoryGroupMapping = {
  externalGroupId: string;
  groupId: UUIDType;
};

export type DirectoryAccountWriteContext = {
  actor: CurrentUserType;
  reportProgress: () => Promise<void>;
};

export type DirectoryLinkOutcome = DirectoryWriteOutcome & {
  failedUserIds: UUIDType[];
};

export type DirectoryGroupMembershipAccount = {
  userId: UUIDType;
  externalId: string;
  isArchived: boolean;
};

export type DirectoryGroupMembershipInput = {
  directoryUsers: DirectoryUser[];
  accounts: DirectoryGroupMembershipAccount[];
  groupMappings: DirectoryGroupMapping[];
  currentGroupIdsByUserId: Map<UUIDType, UUIDType[]>;
};

export type DirectoryGroupMembershipChange = {
  userId: UUIDType;
  groupIds: UUIDType[];
};

export type DirectoryWriteOutcome = {
  succeededCount: number;
  failedCount: number;
};
