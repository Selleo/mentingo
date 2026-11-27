import {
  DIRECTORY_SYNC_ALWAYS_ALLOWED_ARCHIVE_COUNT,
  DIRECTORY_SYNC_SAFEGUARD_VIOLATIONS,
} from "../directory-sync.constants";

import type {
  DirectorySyncSafeguardInput,
  DirectorySyncSafeguardViolation,
} from "../directory-sync.types";

/**
 * Returns the first reason the plan must not be written, or null when it is safe.
 * Guards against a misconfigured scope or a broken directory response wiping out a tenant.
 */
export function findDirectorySyncSafeguardViolation(
  input: DirectorySyncSafeguardInput,
): DirectorySyncSafeguardViolation | null {
  if (input.directoryUserCount === 0) return DIRECTORY_SYNC_SAFEGUARD_VIOLATIONS.EMPTY_DIRECTORY;

  if (exceedsArchiveLimit(input)) return DIRECTORY_SYNC_SAFEGUARD_VIOLATIONS.ARCHIVE_LIMIT_EXCEEDED;

  if (leavesTenantWithoutActiveAdmin(input)) {
    return DIRECTORY_SYNC_SAFEGUARD_VIOLATIONS.NO_ACTIVE_ADMIN_LEFT;
  }

  return null;
}

function exceedsArchiveLimit({
  plan,
  activeLinkedAccountCount,
  archiveLimitPercentage,
}: DirectorySyncSafeguardInput) {
  const archiveCount = plan.userIdsToArchive.length;

  if (archiveLimitPercentage === null) return false;
  if (activeLinkedAccountCount === 0) return false;
  if (archiveCount <= DIRECTORY_SYNC_ALWAYS_ALLOWED_ARCHIVE_COUNT) return false;

  const archivePercentage = (archiveCount / activeLinkedAccountCount) * 100;

  return archivePercentage > archiveLimitPercentage;
}

function leavesTenantWithoutActiveAdmin({
  plan,
  activeAdminUserIds,
  adminRoleSlug,
}: DirectorySyncSafeguardInput) {
  if (!activeAdminUserIds.length) return false;

  const archivedUserIds = new Set(plan.userIdsToArchive);
  const demotedUserIds = new Set(
    plan.roleChanges
      .filter((roleChange) => roleChange.roleSlug !== adminRoleSlug)
      .map((roleChange) => roleChange.userId),
  );

  const remainingAdminCount = activeAdminUserIds.filter(
    (userId) => !archivedUserIds.has(userId) && !demotedUserIds.has(userId),
  ).length;
  const promotedAdminCount = plan.roleChanges.filter(
    (roleChange) =>
      roleChange.roleSlug === adminRoleSlug && !archivedUserIds.has(roleChange.userId),
  ).length;
  const createdAdminCount = plan.accountsToCreate.filter(
    (account) => account.roleSlug === adminRoleSlug,
  ).length;

  return remainingAdminCount + promotedAdminCount + createdAdminCount === 0;
}
