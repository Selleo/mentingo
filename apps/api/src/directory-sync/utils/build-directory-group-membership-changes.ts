import type {
  DirectoryGroupMembershipChange,
  DirectoryGroupMembershipInput,
} from "../directory-sync.types";
import type { UUIDType } from "src/common";

/**
 * Gives every active synced account exactly the mapped groups it belongs to in the directory.
 * Accounts that left the sync scope or are suspended in the directory lose their mapped groups,
 * so nobody stays stuck in a group that admins cannot edit by hand. Groups that are not mapped
 * are kept, and accounts outside the directory are never touched.
 */
export function buildDirectoryGroupMembershipChanges({
  directoryUsers,
  accounts,
  groupMappings,
  currentGroupIdsByUserId,
}: DirectoryGroupMembershipInput): DirectoryGroupMembershipChange[] {
  if (!groupMappings.length) return [];

  const mappedGroupIds = new Set(groupMappings.map((groupMapping) => groupMapping.groupId));
  const directoryUsersByExternalId = new Map(
    directoryUsers.map((directoryUser) => [directoryUser.externalId, directoryUser]),
  );

  return accounts.flatMap((account) => {
    if (account.isArchived) return [];

    const directoryUser = directoryUsersByExternalId.get(account.externalId);
    const isActiveInDirectoryScope = Boolean(directoryUser && !directoryUser.isSuspended);
    const directoryGroupIds = new Set(
      isActiveInDirectoryScope ? (directoryUser?.groupExternalIds ?? []) : [],
    );

    const mappedGroupIdsFromDirectory = groupMappings
      .filter((groupMapping) => directoryGroupIds.has(groupMapping.externalGroupId))
      .map((groupMapping) => groupMapping.groupId);

    const currentGroupIds = currentGroupIdsByUserId.get(account.userId) ?? [];
    const unmappedGroupIds = currentGroupIds.filter((groupId) => !mappedGroupIds.has(groupId));
    const nextGroupIds = Array.from(new Set([...unmappedGroupIds, ...mappedGroupIdsFromDirectory]));

    if (haveSameGroupIds(currentGroupIds, nextGroupIds)) return [];

    return [{ userId: account.userId, groupIds: nextGroupIds }];
  });
}

function haveSameGroupIds(firstGroupIds: UUIDType[], secondGroupIds: UUIDType[]) {
  const firstGroupIdSet = new Set(firstGroupIds);

  return (
    firstGroupIdSet.size === new Set(secondGroupIds).size &&
    secondGroupIds.every((groupId) => firstGroupIdSet.has(groupId))
  );
}
