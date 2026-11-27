import { Injectable, Logger } from "@nestjs/common";
import {
  DIRECTORY_SYNC_CONNECTION_STATUSES,
  DIRECTORY_SYNC_RUN_STATUSES,
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";
import { PermissionsService } from "src/permissions/permissions.service";

import {
  DirectoryProviderAccessDeniedError,
  DirectoryProviderNotConfiguredError,
  DirectoryObjectsNotFoundError,
  DirectorySyncRunInterruptedError,
} from "../directory-sync.errors";
import { DirectoryProviderClientRegistry } from "../providers/directory-provider-client.registry";
import { DirectoryAccountRepository } from "../repositories/directory-account.repository";
import { DirectorySyncConnectionRepository } from "../repositories/directory-sync-connection.repository";
import { DirectorySyncGroupMappingRepository } from "../repositories/directory-sync-group-mapping.repository";
import { DirectorySyncRoleMappingRepository } from "../repositories/directory-sync-role-mapping.repository";
import { DirectorySyncRunRepository } from "../repositories/directory-sync-run.repository";
import { UserExternalIdentityRepository } from "../repositories/user-external-identity.repository";
import { buildDirectoryGroupMembershipChanges } from "../utils/build-directory-group-membership-changes";
import { buildDirectoryReconciliationPlan } from "../utils/build-directory-reconciliation-plan";
import { findDirectorySyncSafeguardViolation } from "../utils/find-directory-sync-safeguard-violation";
import { isConnectionSyncable } from "../utils/is-connection-syncable";

import { DirectoryAccountProvisioningService } from "./directory-account-provisioning.service";

import type {
  DirectoryAccountWriteContext,
  DirectoryGroupMapping,
  DirectoryReconciliationInput,
  DirectoryUser,
  DirectoryWriteOutcome,
} from "../directory-sync.types";
import type { DirectorySyncConnection } from "../repositories/directory-sync-connection.repository";
import type { DirectorySyncRun } from "../repositories/directory-sync-run.repository";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class DirectorySyncService {
  private readonly logger = new Logger(DirectorySyncService.name);

  constructor(
    private readonly directorySyncConnectionRepository: DirectorySyncConnectionRepository,
    private readonly directorySyncRunRepository: DirectorySyncRunRepository,
    private readonly directorySyncRoleMappingRepository: DirectorySyncRoleMappingRepository,
    private readonly directorySyncGroupMappingRepository: DirectorySyncGroupMappingRepository,
    private readonly userExternalIdentityRepository: UserExternalIdentityRepository,
    private readonly directoryAccountRepository: DirectoryAccountRepository,
    private readonly directoryProviderClientRegistry: DirectoryProviderClientRegistry,
    private readonly directoryAccountProvisioningService: DirectoryAccountProvisioningService,
    private readonly permissionsService: PermissionsService,
  ) {}

  /**
   * Worker entry point: reads the directory, plans the changes, checks the safeguards and
   * writes the plan. The run row records the outcome; error details only go to the logs.
   */
  async synchronizeDirectoryForRun(runId: UUIDType) {
    const run = await this.directorySyncRunRepository.findRunById(runId);

    if (run?.status !== DIRECTORY_SYNC_RUN_STATUSES.QUEUED) return;

    const connection = await this.directorySyncConnectionRepository.findConnectionById(
      run.connectionId,
    );

    if (!connection || !isConnectionSyncable(connection)) {
      await this.finishRun(run.id, DIRECTORY_SYNC_RUN_STATUSES.FAILED);
      return;
    }

    const startedRun = await this.directorySyncRunRepository.updateUnfinishedRun(run.id, {
      status: DIRECTORY_SYNC_RUN_STATUSES.RUNNING,
      startedAt: new Date().toISOString(),
    });

    if (!startedRun) return;

    try {
      await this.synchronizeDirectoryConnection(run, connection);
    } catch (error) {
      await this.recordFailedRun(run, connection, error);
    }
  }

  private async synchronizeDirectoryConnection(
    run: DirectorySyncRun,
    connection: DirectorySyncConnection,
  ) {
    const activeAdmins = await this.directoryAccountRepository.findActiveUserIdsWithRoleSlug(
      SYSTEM_ROLE_SLUGS.ADMIN,
    );
    const actor = await this.resolveSyncActor(
      run,
      connection,
      activeAdmins.map((admin) => admin.userId),
    );
    const writeContext: DirectoryAccountWriteContext = {
      actor,
      reportProgress: () => this.confirmRunStillRunning(run.id),
    };

    const groupMappings = await this.directorySyncGroupMappingRepository.findGroupMappings(
      connection.id,
    );
    const reconciliationInput = await this.loadReconciliationInput(
      connection,
      groupMappings.map((groupMapping) => groupMapping.externalGroupId),
      [actor.userId],
      writeContext.reportProgress,
    );
    await writeContext.reportProgress();

    const plan = buildDirectoryReconciliationPlan(reconciliationInput);

    const activeLinkedAccountCount = reconciliationInput.linkedAccounts.filter(
      (account) => !account.isArchived,
    ).length;

    const safeguardViolation = findDirectorySyncSafeguardViolation({
      plan,
      directoryUserCount: reconciliationInput.directoryUsers.length,
      activeLinkedAccountCount,
      archiveLimitPercentage: connection.archiveLimitPercentage,
      activeAdminUserIds: activeAdmins.map((admin) => admin.userId),
      adminRoleSlug: SYSTEM_ROLE_SLUGS.ADMIN,
    });

    if (safeguardViolation) {
      this.logger.warn(
        `Directory sync run ${run.id} aborted by safeguard ${safeguardViolation}: ` +
          `${plan.userIdsToArchive.length} to archive, ${activeLinkedAccountCount} active linked`,
      );
      await this.finishRun(run.id, DIRECTORY_SYNC_RUN_STATUSES.ABORTED_BY_SAFEGUARD);
      return;
    }

    await writeContext.reportProgress();

    const writeSummary =
      await this.directoryAccountProvisioningService.writeDirectoryReconciliationPlan(
        connection,
        plan,
        writeContext,
      );
    await writeContext.reportProgress();

    const groupMembershipOutcome = await this.synchronizeGroupMemberships(
      connection,
      reconciliationInput.directoryUsers,
      groupMappings,
      writeContext,
    );

    const finishedRun = await this.directorySyncRunRepository.updateUnfinishedRun(run.id, {
      status: DIRECTORY_SYNC_RUN_STATUSES.SUCCEEDED,
      finishedAt: new Date().toISOString(),
      createdUsersCount: writeSummary.createdUsersCount,
      linkedUsersCount: writeSummary.linkedUsersCount,
      roleChangedUsersCount: writeSummary.roleChangedUsersCount,
      archivedUsersCount: writeSummary.archivedUsersCount,
      restoredUsersCount: writeSummary.restoredUsersCount,
      groupMembershipChangedUsersCount: groupMembershipOutcome.succeededCount,
      skippedUsersCount:
        plan.skippedAccounts.length +
        writeSummary.failedUsersCount +
        groupMembershipOutcome.failedCount,
    });

    if (!finishedRun) {
      this.logger.warn(`Directory sync run ${run.id} was closed as stale before it finished`);
      return;
    }

    await this.directorySyncConnectionRepository.updateConnection(connection.id, {
      status: DIRECTORY_SYNC_CONNECTION_STATUSES.ACTIVE,
      lastSuccessfulSyncAt: new Date().toISOString(),
      missingExternalIds: [],
    });
  }

  /**
   * Runs after accounts are written, so users created or restored in this run get their groups
   * in the same run.
   */
  private async synchronizeGroupMemberships(
    connection: DirectorySyncConnection,
    directoryUsers: DirectoryUser[],
    groupMappings: DirectoryGroupMapping[],
    writeContext: DirectoryAccountWriteContext,
  ): Promise<DirectoryWriteOutcome> {
    if (!groupMappings.length) return { succeededCount: 0, failedCount: 0 };

    const accounts = await this.userExternalIdentityRepository.findLinkedAccountsForConnection(
      connection.id,
    );
    const memberships = await this.directoryAccountRepository.findGroupIdsForUsers(
      accounts.map((account) => account.userId),
    );

    const groupMembershipChanges = buildDirectoryGroupMembershipChanges({
      directoryUsers,
      accounts,
      groupMappings,
      currentGroupIdsByUserId: groupIdsByUserId(memberships),
    });

    return this.directoryAccountProvisioningService.replaceDirectoryGroupMemberships(
      groupMembershipChanges,
      writeContext,
    );
  }

  private async loadReconciliationInput(
    connection: DirectorySyncConnection,
    groupMappingExternalIds: string[],
    protectedUserIds: UUIDType[],
    reportProgress: () => Promise<void>,
  ): Promise<DirectoryReconciliationInput> {
    if (!connection.directoryCustomerId) {
      throw new DirectoryProviderNotConfiguredError(
        `Directory sync connection ${connection.id} has not been verified`,
      );
    }

    const roleMappings =
      await this.directorySyncRoleMappingRepository.findRoleMappingsWithRoleSlugs(connection.id);
    const [defaultRole] = await this.directoryAccountRepository.findRolesByIds([
      connection.defaultRoleId,
    ]);

    if (!defaultRole) {
      throw new Error(`Default role of directory sync connection ${connection.id} is missing`);
    }

    const directoryUsers = await this.directoryProviderClientRegistry
      .getClientForProvider(connection.provider)
      .listDirectoryUsersInScope(
        {
          administratorEmail: connection.administratorEmail,
          directoryCustomerId: connection.directoryCustomerId,
          scopeType: connection.scopeType,
          scopeExternalIds: connection.scopeExternalIds,
        },
        Array.from(
          new Set([
            ...roleMappings.map((roleMapping) => roleMapping.externalGroupId),
            ...groupMappingExternalIds,
          ]),
        ),
        reportProgress,
      );

    const linkedAccounts =
      await this.userExternalIdentityRepository.findLinkedAccountsForConnection(connection.id);
    const emailMatchCandidates =
      await this.directoryAccountRepository.findAccountsByEmailsWithLinkedIdentity(
        connection.provider,
        collectUnlinkedDirectoryEmails(directoryUsers, linkedAccounts),
      );
    const roleSlugsByUserId = await this.loadRoleSlugsByUserId([
      ...linkedAccounts.map((account) => account.userId),
      ...emailMatchCandidates.map((candidate) => candidate.userId),
    ]);

    return {
      directoryUsers,
      linkedAccounts: linkedAccounts.map((account) => ({
        ...account,
        roleSlugs: roleSlugsByUserId.get(account.userId) ?? [],
      })),
      emailMatchCandidates: emailMatchCandidates.map((candidate) => ({
        ...candidate,
        roleSlugs: roleSlugsByUserId.get(candidate.userId) ?? [],
      })),
      roleMappings,
      defaultRoleSlug: defaultRole.slug,
      archiveUsersOutsideScope: connection.archiveUsersOutsideScope,
      protectedUserIds,
    };
  }

  private async loadRoleSlugsByUserId(userIds: UUIDType[]) {
    const roleAssignments = await this.directoryAccountRepository.findRoleSlugsForUsers(userIds);
    const roleSlugsByUserId = new Map<UUIDType, string[]>();

    for (const roleAssignment of roleAssignments) {
      const roleSlugs = roleSlugsByUserId.get(roleAssignment.userId) ?? [];
      roleSlugsByUserId.set(roleAssignment.userId, [...roleSlugs, roleAssignment.roleSlug]);
    }

    return roleSlugsByUserId;
  }

  /** Stops the worker as soon as its run is closed as stale or disconnected. */
  private async confirmRunStillRunning(runId: UUIDType) {
    const isStillRunning = await this.directorySyncRunRepository.touchRunningRun(runId);

    if (!isStillRunning) throw new DirectorySyncRunInterruptedError(runId);
  }

  private async recordFailedRun(
    run: DirectorySyncRun,
    connection: DirectorySyncConnection,
    error: unknown,
  ) {
    if (error instanceof DirectorySyncRunInterruptedError) {
      this.logger.warn(error.message);
      return;
    }

    this.logger.error(`Directory sync run ${run.id} failed`, error);

    await this.finishRun(run.id, DIRECTORY_SYNC_RUN_STATUSES.FAILED);

    if (connection.directoryCustomerId && isConnectionConfigurationError(error)) {
      await this.directorySyncConnectionRepository.updateConnection(connection.id, {
        status: DIRECTORY_SYNC_CONNECTION_STATUSES.FAILING,
        missingExternalIds:
          error instanceof DirectoryObjectsNotFoundError ? error.missingExternalIds : [],
      });
    }
  }

  private async finishRun(
    runId: UUIDType,
    status:
      | typeof DIRECTORY_SYNC_RUN_STATUSES.FAILED
      | typeof DIRECTORY_SYNC_RUN_STATUSES.ABORTED_BY_SAFEGUARD,
  ) {
    await this.directorySyncRunRepository.updateUnfinishedRun(runId, {
      status,
      finishedAt: new Date().toISOString(),
    });
  }

  /**
   * Changes are recorded under the user who started the run: the admin who clicked Sync now,
   * or for scheduled runs the admin who set up the connection. That user is also protected from
   * being demoted or archived by the run. Only active users who may still manage directory sync
   * qualify; otherwise any active admin is used.
   */
  private async resolveSyncActor(
    run: DirectorySyncRun,
    connection: DirectorySyncConnection,
    activeAdminUserIds: UUIDType[],
  ): Promise<CurrentUserType> {
    const candidateUserIds = [
      run.triggeredByUserId,
      connection.createdByUserId,
      ...activeAdminUserIds,
    ];

    for (const candidateUserId of candidateUserIds) {
      if (!candidateUserId) continue;

      const email = await this.directoryAccountRepository.findActiveUserEmailById(candidateUserId);

      if (!email) continue;

      const { roleSlugs, permissions } =
        await this.permissionsService.getUserAccess(candidateUserId);

      if (!hasPermission(permissions, PERMISSIONS.DIRECTORY_SYNC_MANAGE)) continue;

      return {
        userId: candidateUserId,
        email,
        roleSlugs,
        permissions,
        tenantId: connection.tenantId,
      };
    }

    throw new Error(`No user is available to record directory sync run ${run.id}`);
  }
}

function collectUnlinkedDirectoryEmails(
  directoryUsers: DirectoryUser[],
  linkedAccounts: Array<{ externalId: string }>,
) {
  const linkedExternalIds = new Set(linkedAccounts.map((account) => account.externalId));

  return directoryUsers
    .filter((directoryUser) => !linkedExternalIds.has(directoryUser.externalId))
    .map((directoryUser) => directoryUser.email.toLowerCase());
}

function groupIdsByUserId(memberships: Array<{ userId: UUIDType; groupId: UUIDType }>) {
  const groupIdsForUser = new Map<UUIDType, UUIDType[]>();

  for (const membership of memberships) {
    const groupIds = groupIdsForUser.get(membership.userId) ?? [];
    groupIdsForUser.set(membership.userId, [...groupIds, membership.groupId]);
  }

  return groupIdsForUser;
}

function isConnectionConfigurationError(error: unknown) {
  return (
    error instanceof DirectoryProviderAccessDeniedError ||
    error instanceof DirectoryProviderNotConfiguredError ||
    error instanceof DirectoryObjectsNotFoundError
  );
}
