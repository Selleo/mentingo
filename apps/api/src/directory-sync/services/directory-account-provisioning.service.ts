import { Injectable, Logger } from "@nestjs/common";
import { DIRECTORY_SYNC_CHANGE_SOURCE } from "@repo/shared";

import { GroupService } from "src/group/group.service";
import { BULK_ASSIGN_USERS_TO_GROUPS_SOURCES } from "src/group/types/group-membership-assignment.types";
import { SessionRevocationService } from "src/redis/session-revocation.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { UserService } from "src/user/user.service";
import { USER_CREATION_FLOW_TYPE } from "src/user/user.types";

import { DIRECTORY_SYNC_PROGRESS_REPORT_INTERVAL } from "../directory-sync.constants";
import { UserExternalIdentityRepository } from "../repositories/user-external-identity.repository";

import type {
  DirectoryAccountToCreate,
  DirectoryAccountToLink,
  DirectoryAccountWriteContext,
  DirectoryGroupMembershipChange,
  DirectoryLinkOutcome,
  DirectoryPlanWriteSummary,
  DirectoryReconciliationPlan,
  DirectoryRoleChange,
  DirectoryWriteOutcome,
} from "../directory-sync.types";
import type { DirectorySyncConnection } from "../repositories/directory-sync-connection.repository";
import type { UUIDType } from "src/common";

/**
 * Writes a reconciliation plan through UserService and GroupService, so user limits, events,
 * enrolments and session revocation behave like changes made by an admin. Every change is
 * recorded in the activity log under the run's actor with the directory sync source. Each
 * account is written on its own, so one failing account does not stop the rest of the run.
 */
@Injectable()
export class DirectoryAccountProvisioningService {
  private readonly logger = new Logger(DirectoryAccountProvisioningService.name);

  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
    private readonly userExternalIdentityRepository: UserExternalIdentityRepository,
    private readonly sessionRevocationService: SessionRevocationService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async writeDirectoryReconciliationPlan(
    connection: DirectorySyncConnection,
    plan: DirectoryReconciliationPlan,
    writeContext: DirectoryAccountWriteContext,
  ): Promise<DirectoryPlanWriteSummary> {
    const linkOutcome = await this.linkExistingAccounts(
      connection,
      plan.accountsToLink,
      writeContext,
    );
    const unlinkedUserIds = new Set(linkOutcome.failedUserIds);
    const isLinkedOrAlreadyLinked = (userId: UUIDType) => !unlinkedUserIds.has(userId);

    const createOutcome = await this.createDirectoryAccounts(
      connection,
      plan.accountsToCreate,
      writeContext,
    );
    const archiveOutcome = await this.archiveDirectoryAccounts(
      connection,
      plan.userIdsToArchive.filter(isLinkedOrAlreadyLinked),
      writeContext,
    );
    const restoreOutcome = await this.restoreDirectoryAccounts(
      connection,
      plan.userIdsToRestore,
      writeContext,
    );
    const roleOutcome = await this.replaceDirectoryAccountRoles(
      plan.roleChanges.filter((roleChange) => isLinkedOrAlreadyLinked(roleChange.userId)),
      writeContext,
    );
    await this.userExternalIdentityRepository.markRolesOverridden(
      connection.id,
      plan.userIdsToMarkRolesOverridden.filter(isLinkedOrAlreadyLinked),
    );

    return {
      createdUsersCount: createOutcome.succeededCount,
      linkedUsersCount: linkOutcome.succeededCount,
      roleChangedUsersCount: roleOutcome.succeededCount,
      archivedUsersCount: archiveOutcome.succeededCount,
      restoredUsersCount: restoreOutcome.succeededCount,
      failedUsersCount: [linkOutcome, createOutcome, archiveOutcome, restoreOutcome, roleOutcome]
        .map((outcome) => outcome.failedCount)
        .reduce((total, failedCount) => total + failedCount, 0),
    };
  }

  async replaceDirectoryGroupMemberships(
    groupMembershipChanges: DirectoryGroupMembershipChange[],
    writeContext: DirectoryAccountWriteContext,
  ): Promise<DirectoryWriteOutcome> {
    return this.writeEachAccount(
      groupMembershipChanges,
      (groupMembershipChange) => groupMembershipChange.userId,
      (groupMembershipChange) =>
        this.groupService.changeUsersGroups([groupMembershipChange], {
          actor: writeContext.actor,
          source: BULK_ASSIGN_USERS_TO_GROUPS_SOURCES.DIRECTORY_SYNC,
        }),
      writeContext,
    );
  }

  private async linkExistingAccounts(
    connection: DirectorySyncConnection,
    accountsToLink: DirectoryAccountToLink[],
    writeContext: DirectoryAccountWriteContext,
  ): Promise<DirectoryLinkOutcome> {
    const failedUserIds: UUIDType[] = [];

    const outcome = await this.writeEachAccount(
      accountsToLink,
      (account) => account.userId,
      (account) =>
        this.userExternalIdentityRepository
          .insertIdentities([
            {
              userId: account.userId,
              externalId: account.externalId,
              connectionId: connection.id,
              provider: connection.provider,
            },
          ])
          .catch((error: unknown) => {
            failedUserIds.push(account.userId);
            throw error;
          }),
      writeContext,
    );

    return { ...outcome, failedUserIds };
  }

  private async createDirectoryAccounts(
    connection: DirectorySyncConnection,
    accountsToCreate: DirectoryAccountToCreate[],
    writeContext: DirectoryAccountWriteContext,
  ): Promise<DirectoryWriteOutcome> {
    return this.writeEachAccount(
      accountsToCreate,
      (account) => account.externalId,
      (account) =>
        this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
          const createdUser = await this.userService.createUser(
            {
              email: account.email,
              firstName: account.firstName,
              lastName: account.lastName,
              roleSlugs: [account.roleSlug],
            },
            transaction,
            {
              flowType: USER_CREATION_FLOW_TYPE.DIRECTORY_SYNC,
              sendWelcomeEmail: connection.sendWelcomeEmail,
              creator: writeContext.actor,
            },
          );

          await this.userExternalIdentityRepository.insertIdentities([
            {
              userId: createdUser.id,
              externalId: account.externalId,
              connectionId: connection.id,
              provider: connection.provider,
            },
          ]);
        }),
      writeContext,
    );
  }

  private async archiveDirectoryAccounts(
    connection: DirectorySyncConnection,
    userIds: UUIDType[],
    writeContext: DirectoryAccountWriteContext,
  ): Promise<DirectoryWriteOutcome> {
    return this.writeEachAccount(
      userIds,
      (userId) => userId,
      async (userId) => {
        await this.tenantDbRunnerService.transactionWithHandle(async () => {
          await this.userService.updateUser(userId, { archived: true }, writeContext.actor, {
            source: DIRECTORY_SYNC_CHANGE_SOURCE,
          });
          await this.userExternalIdentityRepository.updateArchivedByDirectorySync(
            connection.id,
            [userId],
            true,
          );
        });

        await this.sessionRevocationService.revokeUserSessions(userId);
      },
      writeContext,
    );
  }

  private async restoreDirectoryAccounts(
    connection: DirectorySyncConnection,
    userIds: UUIDType[],
    writeContext: DirectoryAccountWriteContext,
  ): Promise<DirectoryWriteOutcome> {
    return this.writeEachAccount(
      userIds,
      (userId) => userId,
      (userId) =>
        this.tenantDbRunnerService.transactionWithHandle(async () => {
          await this.userService.updateUser(userId, { archived: false }, writeContext.actor, {
            source: DIRECTORY_SYNC_CHANGE_SOURCE,
          });
          await this.userExternalIdentityRepository.updateArchivedByDirectorySync(
            connection.id,
            [userId],
            false,
          );
        }),
      writeContext,
    );
  }

  private async replaceDirectoryAccountRoles(
    roleChanges: DirectoryRoleChange[],
    writeContext: DirectoryAccountWriteContext,
  ): Promise<DirectoryWriteOutcome> {
    return this.writeEachAccount(
      roleChanges,
      (roleChange) => roleChange.userId,
      (roleChange) =>
        this.userService.updateUser(
          roleChange.userId,
          { roleSlugs: [roleChange.roleSlug] },
          writeContext.actor,
          { source: DIRECTORY_SYNC_CHANGE_SOURCE },
        ),
      writeContext,
    );
  }

  private async writeEachAccount<TAccount>(
    accounts: TAccount[],
    describeAccount: (account: TAccount) => string,
    writeAccount: (account: TAccount) => Promise<unknown>,
    writeContext: DirectoryAccountWriteContext,
  ): Promise<DirectoryWriteOutcome> {
    let succeededCount = 0;
    let failedCount = 0;

    for (const [index, account] of accounts.entries()) {
      try {
        await writeAccount(account);
        succeededCount += 1;
      } catch (error) {
        failedCount += 1;
        this.logger.error(`Failed to write directory account ${describeAccount(account)}`, error);
      }

      if ((index + 1) % DIRECTORY_SYNC_PROGRESS_REPORT_INTERVAL === 0) {
        await writeContext.reportProgress();
      }
    }

    return { succeededCount, failedCount };
  }
}
