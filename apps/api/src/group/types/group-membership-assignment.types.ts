import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export const BULK_ASSIGN_USERS_TO_GROUPS_SOURCES = {
  IMPORT: "import",
  BULK_EDIT: "bulk-edit",
} as const;

export type BulkAssignUsersToGroupsSource =
  (typeof BULK_ASSIGN_USERS_TO_GROUPS_SOURCES)[keyof typeof BULK_ASSIGN_USERS_TO_GROUPS_SOURCES];

export type UserGroupAssignment = {
  userId: UUIDType;
  groupIds: UUIDType[];
};

export type UserGroupMembershipUpdate = {
  userId: UUIDType;
  groupIdsToAssign: UUIDType[];
  groupIdsToRemove: UUIDType[];
};

export type ChangeUsersGroupsOptions = {
  actor: CurrentUserType;
  source: BulkAssignUsersToGroupsSource;
  db?: DatabasePg;
};
