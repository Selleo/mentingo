import { match, P } from "ts-pattern";

import { DIRECTORY_SYNC_SKIP_REASONS } from "../directory-sync.constants";

import type {
  DirectoryEmailMatchCandidate,
  DirectoryReconciliationInput,
  DirectoryReconciliationPlan,
  DirectoryRoleMapping,
  DirectoryUser,
  LinkedDirectoryAccount,
} from "../directory-sync.types";
import type { UUIDType } from "src/common";

/**
 * Decides what a sync run changes in Mentingo, without touching the database.
 * Existing accounts keep their name and email; only roles and archive state follow the directory.
 * Restores only accounts that the sync itself archived, never ones archived by an admin.
 * The user who started the run keeps their roles; instead of changing them, their roles are
 * marked as overridden so admins can see it and restore directory roles later.
 */
export function buildDirectoryReconciliationPlan(
  input: DirectoryReconciliationInput,
): DirectoryReconciliationPlan {
  const plan: DirectoryReconciliationPlan = {
    accountsToCreate: [],
    accountsToLink: [],
    roleChanges: [],
    userIdsToArchive: [],
    userIdsToRestore: [],
    userIdsToMarkRolesOverridden: [],
    skippedAccounts: [],
  };

  const linkedAccountsByExternalId = new Map(
    input.linkedAccounts.map((account) => [account.externalId, account]),
  );
  const emailMatchCandidatesByEmail = new Map(
    input.emailMatchCandidates.map((candidate) => [candidate.email.toLowerCase(), candidate]),
  );
  const protectedUserIds = new Set(input.protectedUserIds);
  const userIdsSeenInDirectory = new Set<UUIDType>();

  for (const directoryUser of input.directoryUsers) {
    const targetRoleSlug = resolveTargetRoleSlug(
      directoryUser,
      input.roleMappings,
      input.defaultRoleSlug,
    );
    const linkedAccount = linkedAccountsByExternalId.get(directoryUser.externalId);

    if (linkedAccount) {
      userIdsSeenInDirectory.add(linkedAccount.userId);
      planChangesForLinkedAccount(
        plan,
        linkedAccount,
        directoryUser,
        targetRoleSlug,
        protectedUserIds,
      );
      continue;
    }

    const emailMatchCandidate = emailMatchCandidatesByEmail.get(directoryUser.email.toLowerCase());

    planChangesForUnlinkedDirectoryUser(
      plan,
      directoryUser,
      emailMatchCandidate,
      targetRoleSlug,
      protectedUserIds,
    );

    if (emailMatchCandidate) userIdsSeenInDirectory.add(emailMatchCandidate.userId);
  }

  if (input.archiveUsersOutsideScope) {
    const accountsOutsideScope = input.linkedAccounts.filter(
      (account) => !userIdsSeenInDirectory.has(account.userId) && !account.isArchived,
    );

    for (const account of accountsOutsideScope) {
      planArchiveOfAccount(plan, account.userId, account.externalId, protectedUserIds);
    }
  }

  return plan;
}

function resolveTargetRoleSlug(
  directoryUser: DirectoryUser,
  roleMappings: DirectoryRoleMapping[],
  defaultRoleSlug: string,
) {
  const memberGroupIds = new Set(directoryUser.groupExternalIds);
  const highestPriorityMapping = [...roleMappings]
    .sort((first, second) => first.priority - second.priority)
    .find((roleMapping) => memberGroupIds.has(roleMapping.externalGroupId));

  return highestPriorityMapping?.roleSlug ?? defaultRoleSlug;
}

function planChangesForUnlinkedDirectoryUser(
  plan: DirectoryReconciliationPlan,
  directoryUser: DirectoryUser,
  emailMatchCandidate: DirectoryEmailMatchCandidate | undefined,
  targetRoleSlug: string,
  protectedUserIds: Set<UUIDType>,
) {
  match({ emailMatchCandidate, isSuspended: directoryUser.isSuspended })
    .with({ emailMatchCandidate: P.nullish, isSuspended: true }, () => {
      plan.skippedAccounts.push({
        externalId: directoryUser.externalId,
        userId: null,
        reason: DIRECTORY_SYNC_SKIP_REASONS.SUSPENDED_WITHOUT_ACCOUNT,
      });
    })
    .with({ emailMatchCandidate: P.nullish, isSuspended: false }, () => {
      plan.accountsToCreate.push({
        externalId: directoryUser.externalId,
        email: directoryUser.email,
        firstName: directoryUser.firstName,
        lastName: directoryUser.lastName,
        roleSlug: targetRoleSlug,
      });
    })
    .with({ emailMatchCandidate: { linkedExternalId: P.string } }, ({ emailMatchCandidate }) => {
      plan.skippedAccounts.push({
        externalId: directoryUser.externalId,
        userId: emailMatchCandidate.userId,
        reason: DIRECTORY_SYNC_SKIP_REASONS.EMAIL_LINKED_TO_ANOTHER_DIRECTORY_ACCOUNT,
      });
    })
    .with({ emailMatchCandidate: P.nonNullable }, ({ emailMatchCandidate }) => {
      plan.accountsToLink.push({
        userId: emailMatchCandidate.userId,
        externalId: directoryUser.externalId,
      });

      const newlyLinkedAccount: LinkedDirectoryAccount = {
        userId: emailMatchCandidate.userId,
        externalId: directoryUser.externalId,
        isArchived: emailMatchCandidate.isArchived,
        archivedByDirectorySync: false,
        rolesOverridden: false,
        roleSlugs: emailMatchCandidate.roleSlugs,
      };

      planChangesForLinkedAccount(
        plan,
        newlyLinkedAccount,
        directoryUser,
        targetRoleSlug,
        protectedUserIds,
      );
    })
    .exhaustive();
}

function planChangesForLinkedAccount(
  plan: DirectoryReconciliationPlan,
  account: LinkedDirectoryAccount,
  directoryUser: DirectoryUser,
  targetRoleSlug: string,
  protectedUserIds: Set<UUIDType>,
) {
  match({
    isSuspended: directoryUser.isSuspended,
    isArchived: account.isArchived,
    archivedByDirectorySync: account.archivedByDirectorySync,
  })
    .with({ isSuspended: true, isArchived: false }, () => {
      planArchiveOfAccount(plan, account.userId, account.externalId, protectedUserIds);
    })
    .with({ isSuspended: true, isArchived: true }, () => undefined)
    .with({ isSuspended: false, isArchived: true, archivedByDirectorySync: true }, () => {
      plan.userIdsToRestore.push(account.userId);
      planRoleChangeOfAccount(plan, account, targetRoleSlug, protectedUserIds);
    })
    .with({ isSuspended: false, isArchived: true, archivedByDirectorySync: false }, () => {
      plan.skippedAccounts.push({
        externalId: account.externalId,
        userId: account.userId,
        reason: DIRECTORY_SYNC_SKIP_REASONS.ARCHIVED_MANUALLY,
      });
    })
    .with({ isSuspended: false, isArchived: false }, () => {
      planRoleChangeOfAccount(plan, account, targetRoleSlug, protectedUserIds);
    })
    .exhaustive();
}

function planArchiveOfAccount(
  plan: DirectoryReconciliationPlan,
  userId: UUIDType,
  externalId: string,
  protectedUserIds: Set<UUIDType>,
) {
  if (protectedUserIds.has(userId)) {
    plan.skippedAccounts.push({
      externalId,
      userId,
      reason: DIRECTORY_SYNC_SKIP_REASONS.PROTECTED_SYNC_INITIATOR,
    });
    return;
  }

  plan.userIdsToArchive.push(userId);
}

function planRoleChangeOfAccount(
  plan: DirectoryReconciliationPlan,
  account: LinkedDirectoryAccount,
  targetRoleSlug: string,
  protectedUserIds: Set<UUIDType>,
) {
  if (account.rolesOverridden || hasExactlyRole(account.roleSlugs, targetRoleSlug)) return;

  if (protectedUserIds.has(account.userId)) {
    plan.userIdsToMarkRolesOverridden.push(account.userId);
    return;
  }

  plan.roleChanges.push({ userId: account.userId, roleSlug: targetRoleSlug });
}

function hasExactlyRole(roleSlugs: string[], roleSlug: string) {
  const uniqueRoleSlugs = new Set(roleSlugs);

  return uniqueRoleSlugs.size === 1 && uniqueRoleSlugs.has(roleSlug);
}
