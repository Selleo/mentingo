import type { DirectorySyncConnection } from "../repositories/directory-sync-connection.repository";
import type { DirectorySyncRun } from "../repositories/directory-sync-run.repository";
import type {
  DirectorySyncConnectionResponse,
  DirectorySyncGroupMappingResponse,
  DirectorySyncRoleMappingBody,
  DirectorySyncRunResponse,
} from "../schemas/directory-sync.schema";

export function toDirectorySyncRunResponse(run: DirectorySyncRun): DirectorySyncRunResponse {
  return {
    id: run.id,
    trigger: run.trigger,
    status: run.status,
    triggeredByUserId: run.triggeredByUserId,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdUsersCount: run.createdUsersCount,
    linkedUsersCount: run.linkedUsersCount,
    roleChangedUsersCount: run.roleChangedUsersCount,
    archivedUsersCount: run.archivedUsersCount,
    restoredUsersCount: run.restoredUsersCount,
    groupMembershipChangedUsersCount: run.groupMembershipChangedUsersCount,
    skippedUsersCount: run.skippedUsersCount,
  };
}

export function toDirectorySyncConnectionResponse(
  connection: DirectorySyncConnection,
  roleMappings: DirectorySyncRoleMappingBody[],
  groupMappings: DirectorySyncGroupMappingResponse[],
  latestRun: DirectorySyncRun | null,
): DirectorySyncConnectionResponse {
  return {
    id: connection.id,
    provider: connection.provider,
    status: connection.status,
    isVerified: Boolean(connection.directoryCustomerId),
    administratorEmail: connection.administratorEmail,
    scopeType: connection.scopeType,
    scopeExternalIds: connection.scopeExternalIds,
    defaultRoleId: connection.defaultRoleId,
    archiveUsersOutsideScope: connection.archiveUsersOutsideScope,
    sendWelcomeEmail: connection.sendWelcomeEmail,
    archiveLimitPercentage: connection.archiveLimitPercentage,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
    missingExternalIds: connection.missingExternalIds,
    roleMappings,
    groupMappings,
    latestRun: latestRun ? toDirectorySyncRunResponse(latestRun) : null,
  };
}
