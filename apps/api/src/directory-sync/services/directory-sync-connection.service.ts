import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DIRECTORY_SYNC_CONNECTION_STATUSES,
  DIRECTORY_SYNC_ERROR_KEYS,
  DIRECTORY_SYNC_SCOPE_TYPES,
  PERMISSIONS,
  type DirectorySyncProvider,
} from "@repo/shared";
import { match } from "ts-pattern";

import { hasPermission } from "src/common/permissions/permission.utils";
import { GroupService } from "src/group/group.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { DirectoryProviderClientRegistry } from "../providers/directory-provider-client.registry";
import { DirectoryAccountRepository } from "../repositories/directory-account.repository";
import { DirectorySyncConnectionRepository } from "../repositories/directory-sync-connection.repository";
import { DirectorySyncGroupMappingRepository } from "../repositories/directory-sync-group-mapping.repository";
import { DirectorySyncRoleMappingRepository } from "../repositories/directory-sync-role-mapping.repository";
import { DirectorySyncRunRepository } from "../repositories/directory-sync-run.repository";
import { UserExternalIdentityRepository } from "../repositories/user-external-identity.repository";
import {
  toDirectorySyncConnectionResponse,
  toDirectorySyncRunResponse,
} from "../utils/to-directory-sync-response";
import { translateDirectoryProviderError } from "../utils/translate-directory-provider-error";

import { DirectorySyncRunService } from "./directory-sync-run.service";

import type { DirectoryConnectionContext } from "../directory-sync.types";
import type { DirectorySyncConnection } from "../repositories/directory-sync-connection.repository";
import type {
  ReplaceDirectorySyncGroupMappingsBody,
  ReplaceDirectorySyncRoleMappingsBody,
  UpsertDirectorySyncConnectionBody,
} from "../schemas/directory-sync.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class DirectorySyncConnectionService {
  constructor(
    private readonly directorySyncConnectionRepository: DirectorySyncConnectionRepository,
    private readonly directorySyncRoleMappingRepository: DirectorySyncRoleMappingRepository,
    private readonly directorySyncGroupMappingRepository: DirectorySyncGroupMappingRepository,
    private readonly directorySyncRunRepository: DirectorySyncRunRepository,
    private readonly userExternalIdentityRepository: UserExternalIdentityRepository,
    private readonly directoryAccountRepository: DirectoryAccountRepository,
    private readonly directoryProviderClientRegistry: DirectoryProviderClientRegistry,
    private readonly directorySyncRunService: DirectorySyncRunService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly groupService: GroupService,
  ) {}

  async getSetupDetails(provider: DirectorySyncProvider) {
    return this.directoryProviderClientRegistry
      .getClientForProvider(provider)
      .getSetupDetails()
      .catch((error: unknown) => {
        throw translateDirectoryProviderError(error);
      });
  }

  async getConnection(provider: DirectorySyncProvider) {
    const connection =
      await this.directorySyncConnectionRepository.findConnectionByProvider(provider);

    if (!connection) return null;

    return this.buildConnectionResponse(connection);
  }

  /**
   * Changing the administrator email invalidates the previous verification, because
   * delegation is granted per administrator in the customer's directory.
   */
  async upsertConnection(
    provider: DirectorySyncProvider,
    connectionSettings: UpsertDirectorySyncConnectionBody,
    currentUser: CurrentUserType,
  ) {
    this.assertCanManageUsers(currentUser);
    await this.assertRolesExist([connectionSettings.defaultRoleId]);

    const scopeExternalIds = this.resolveScopeExternalIds(connectionSettings);
    const administratorEmail = connectionSettings.administratorEmail.trim().toLowerCase();
    const existingConnection =
      await this.directorySyncConnectionRepository.findConnectionByProvider(provider);

    const connectionValues = {
      administratorEmail,
      scopeType: connectionSettings.scopeType,
      scopeExternalIds,
      defaultRoleId: connectionSettings.defaultRoleId,
      archiveUsersOutsideScope: connectionSettings.archiveUsersOutsideScope,
      sendWelcomeEmail: connectionSettings.sendWelcomeEmail,
      archiveLimitPercentage: connectionSettings.archiveLimitPercentage,
    };

    if (!existingConnection) {
      const createdConnection = await this.directorySyncConnectionRepository.insertConnection({
        ...connectionValues,
        provider,
        createdByUserId: currentUser.userId,
      });

      return this.buildConnectionResponse(createdConnection);
    }

    const administratorChanged = existingConnection.administratorEmail !== administratorEmail;
    const updatedConnection = await this.directorySyncConnectionRepository.updateConnection(
      existingConnection.id,
      administratorChanged
        ? {
            ...connectionValues,
            status: DIRECTORY_SYNC_CONNECTION_STATUSES.PENDING_VERIFICATION,
            directoryCustomerId: null,
          }
        : connectionValues,
    );

    if (!updatedConnection) {
      throw new NotFoundException(DIRECTORY_SYNC_ERROR_KEYS.CONNECTION_NOT_FOUND);
    }

    return this.buildConnectionResponse(updatedConnection);
  }

  async verifyConnection(provider: DirectorySyncProvider) {
    const connection = await this.getExistingConnection(provider);

    const verification = await this.directoryProviderClientRegistry
      .getClientForProvider(provider)
      .verifyDirectoryAccess(connection.administratorEmail)
      .catch(async (error: unknown) => {
        await this.directorySyncConnectionRepository.updateConnection(connection.id, {
          status: connection.directoryCustomerId
            ? DIRECTORY_SYNC_CONNECTION_STATUSES.FAILING
            : DIRECTORY_SYNC_CONNECTION_STATUSES.PENDING_VERIFICATION,
        });
        throw translateDirectoryProviderError(error);
      });

    const verifiedConnection = await this.directorySyncConnectionRepository.updateConnection(
      connection.id,
      {
        status: DIRECTORY_SYNC_CONNECTION_STATUSES.ACTIVE,
        directoryCustomerId: verification.directoryCustomerId,
      },
    );

    if (!verifiedConnection) {
      throw new NotFoundException(DIRECTORY_SYNC_ERROR_KEYS.CONNECTION_NOT_FOUND);
    }

    return this.buildConnectionResponse(verifiedConnection);
  }

  async listOrganizationalUnits(provider: DirectorySyncProvider) {
    const connectionContext = await this.getVerifiedConnectionContext(provider);

    return this.directoryProviderClientRegistry
      .getClientForProvider(provider)
      .listOrganizationalUnits(connectionContext)
      .catch((error: unknown) => {
        throw translateDirectoryProviderError(error);
      });
  }

  async searchGroups(provider: DirectorySyncProvider, searchPhrase: string) {
    const connectionContext = await this.getVerifiedConnectionContext(provider);

    return this.directoryProviderClientRegistry
      .getClientForProvider(provider)
      .searchDirectoryGroups(connectionContext, searchPhrase)
      .catch((error: unknown) => {
        throw translateDirectoryProviderError(error);
      });
  }

  async replaceRoleMappings(
    provider: DirectorySyncProvider,
    roleMappings: ReplaceDirectorySyncRoleMappingsBody,
    currentUser: CurrentUserType,
  ) {
    this.assertCanManageUsers(currentUser);
    const connection = await this.getExistingConnection(provider);

    this.assertRoleMappingsAreUnique(roleMappings);
    await this.assertRolesExist(roleMappings.map((roleMapping) => roleMapping.roleId));

    await this.tenantDbRunnerService.transactionWithHandle(async () => {
      await this.directorySyncRoleMappingRepository.deleteRoleMappingsForConnection(connection.id);
      await this.directorySyncRoleMappingRepository.insertRoleMappings(
        roleMappings.map((roleMapping) => ({ ...roleMapping, connectionId: connection.id })),
      );
    });

    return this.buildConnectionResponse(connection);
  }

  /**
   * A mapping without a Mentingo group creates one named after the directory group, in the
   * same transaction as the mappings.
   */
  async replaceGroupMappings(
    provider: DirectorySyncProvider,
    { language, groupMappings }: ReplaceDirectorySyncGroupMappingsBody,
    currentUser: CurrentUserType,
  ) {
    const connection = await this.getExistingConnection(provider);

    this.assertGroupMappingsAreUnique(groupMappings);
    await this.assertGroupsExist(
      groupMappings.flatMap((groupMapping) => (groupMapping.groupId ? [groupMapping.groupId] : [])),
    );

    await this.tenantDbRunnerService.transactionWithHandle(async () => {
      const resolvedGroupMappings = [];

      for (const groupMapping of groupMappings) {
        const groupId =
          groupMapping.groupId ??
          (
            await this.groupService.createGroup(
              { name: groupMapping.externalGroupName, language },
              currentUser,
            )
          ).id;

        resolvedGroupMappings.push({
          connectionId: connection.id,
          externalGroupId: groupMapping.externalGroupId,
          externalGroupEmail: groupMapping.externalGroupEmail,
          groupId,
        });
      }

      await this.directorySyncGroupMappingRepository.deleteGroupMappingsForConnection(
        connection.id,
      );
      await this.directorySyncGroupMappingRepository.insertGroupMappings(resolvedGroupMappings);
    });

    return this.buildConnectionResponse(connection);
  }

  async requestManualSync(provider: DirectorySyncProvider, currentUser: CurrentUserType) {
    this.assertCanManageUsers(currentUser);
    const connection = await this.getExistingConnection(provider);
    const queuedRun = await this.directorySyncRunService.requestManualDirectorySync(
      connection.id,
      currentUser.userId,
    );

    return toDirectorySyncRunResponse(queuedRun);
  }

  async listRuns(provider: DirectorySyncProvider, page: number, perPage: number) {
    const connection = await this.getExistingConnection(provider);

    const [runs, totalItems] = await Promise.all([
      this.directorySyncRunRepository.findRunsForConnection(connection.id, {
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      this.directorySyncRunRepository.countRunsForConnection(connection.id),
    ]);

    return {
      data: runs.map(toDirectorySyncRunResponse),
      pagination: { totalItems, page, perPage },
    };
  }

  /** The user's roles follow the directory again from the next sync. */
  async restoreDirectoryRoles(userId: UUIDType) {
    const restoredIdentity = await this.userExternalIdentityRepository.clearRolesOverridden(userId);

    if (!restoredIdentity) {
      throw new NotFoundException(DIRECTORY_SYNC_ERROR_KEYS.USER_NOT_SYNCED);
    }
  }

  /**
   * Synced users stay in Mentingo and become manually managed again. Refused while a sync is
   * queued or running, so a worker never keeps writing for a connection that no longer exists.
   */
  async deleteConnection(provider: DirectorySyncProvider) {
    const connection = await this.getExistingConnection(provider);

    await this.directorySyncRunService.failStaleDirectorySyncRuns();

    const unfinishedRun = await this.directorySyncRunRepository.findUnfinishedRunForConnection(
      connection.id,
    );

    if (unfinishedRun) {
      throw new ConflictException(DIRECTORY_SYNC_ERROR_KEYS.DISCONNECT_WHILE_SYNCING);
    }

    await this.directorySyncConnectionRepository.deleteConnection(connection.id);
  }

  private async buildConnectionResponse(connection: DirectorySyncConnection) {
    const [roleMappings, groupMappings, latestRun] = await Promise.all([
      this.directorySyncRoleMappingRepository.findRoleMappingsWithRoleSlugs(connection.id),
      this.directorySyncGroupMappingRepository.findGroupMappings(connection.id),
      this.directorySyncRunRepository.findLatestRunForConnection(connection.id),
    ]);

    return toDirectorySyncConnectionResponse(
      connection,
      roleMappings.map(({ externalGroupId, externalGroupEmail, roleId, priority }) => ({
        externalGroupId,
        externalGroupEmail,
        roleId,
        priority,
      })),
      groupMappings,
      latestRun,
    );
  }

  private async getExistingConnection(provider: DirectorySyncProvider) {
    const connection =
      await this.directorySyncConnectionRepository.findConnectionByProvider(provider);

    if (!connection) throw new NotFoundException(DIRECTORY_SYNC_ERROR_KEYS.CONNECTION_NOT_FOUND);

    return connection;
  }

  private async getVerifiedConnectionContext(
    provider: DirectorySyncProvider,
  ): Promise<DirectoryConnectionContext> {
    const connection = await this.getExistingConnection(provider);

    if (!connection.directoryCustomerId) {
      throw new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.CONNECTION_NOT_ACTIVE);
    }

    return {
      administratorEmail: connection.administratorEmail,
      directoryCustomerId: connection.directoryCustomerId,
      scopeType: connection.scopeType,
      scopeExternalIds: connection.scopeExternalIds,
    };
  }

  private resolveScopeExternalIds(connectionSettings: UpsertDirectorySyncConnectionBody) {
    const uniqueScopeExternalIds = Array.from(new Set(connectionSettings.scopeExternalIds));

    return match(connectionSettings.scopeType)
      .with(DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS, () => [])
      .with(
        DIRECTORY_SYNC_SCOPE_TYPES.ORGANIZATIONAL_UNITS,
        DIRECTORY_SYNC_SCOPE_TYPES.GROUPS,
        () => {
          if (!uniqueScopeExternalIds.length) {
            throw new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.INVALID_SCOPE);
          }

          return uniqueScopeExternalIds;
        },
      )
      .exhaustive();
  }

  /**
   * The connection's roles, archiving and the sync itself create, archive and assign roles to
   * users, so they need the same user management permission as doing that by hand.
   */
  private assertCanManageUsers(currentUser: CurrentUserType) {
    if (!hasPermission(currentUser.permissions, PERMISSIONS.USER_MANAGE)) {
      throw new ForbiddenException("common.toast.noAccess");
    }
  }

  private assertRoleMappingsAreUnique(roleMappings: ReplaceDirectorySyncRoleMappingsBody) {
    const groupIds = new Set(roleMappings.map((roleMapping) => roleMapping.externalGroupId));
    const priorities = new Set(roleMappings.map((roleMapping) => roleMapping.priority));

    if (groupIds.size !== roleMappings.length || priorities.size !== roleMappings.length) {
      throw new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.DUPLICATE_ROLE_MAPPING);
    }
  }

  private assertGroupMappingsAreUnique(
    groupMappings: ReplaceDirectorySyncGroupMappingsBody["groupMappings"],
  ) {
    const externalGroupIds = new Set(
      groupMappings.map((groupMapping) => groupMapping.externalGroupId),
    );
    const existingGroupIds = groupMappings.flatMap((groupMapping) =>
      groupMapping.groupId ? [groupMapping.groupId] : [],
    );

    if (
      externalGroupIds.size !== groupMappings.length ||
      new Set(existingGroupIds).size !== existingGroupIds.length
    ) {
      throw new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.DUPLICATE_GROUP_MAPPING);
    }
  }

  private async assertGroupsExist(groupIds: UUIDType[]) {
    const existingGroups = await this.directoryAccountRepository.findGroupIdsByIds(groupIds);

    if (existingGroups.length !== groupIds.length) {
      throw new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.INVALID_GROUP);
    }
  }

  private async assertRolesExist(roleIds: UUIDType[]) {
    const uniqueRoleIds = Array.from(new Set(roleIds));
    const existingRoles = await this.directoryAccountRepository.findRolesByIds(uniqueRoleIds);

    if (existingRoles.length !== uniqueRoleIds.length) {
      throw new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.INVALID_ROLE);
    }
  }
}
