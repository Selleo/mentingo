import { Injectable } from "@nestjs/common";
import { DIRECTORY_SYNC_SCOPE_TYPES } from "@repo/shared";
import { match } from "ts-pattern";

import {
  FAKE_DIRECTORY_CLIENT_ID,
  FAKE_DIRECTORY_DISABLED_ENVIRONMENTS,
  FAKE_DIRECTORY_FIXTURE_ENV,
} from "../../directory-sync.constants";
import {
  DirectoryObjectsNotFoundError,
  DirectoryProviderAccessDeniedError,
} from "../../directory-sync.errors";
import { isOrganizationalUnitPathWithin } from "../../utils/is-organizational-unit-path-within";
import { GOOGLE_WORKSPACE_DIRECTORY_SCOPES } from "../google-workspace-directory.constants";

import { readFakeDirectoryWorkspace } from "./read-fake-directory-workspace";

import type { FakeDirectoryWorkspace } from "./fake-directory.schema";
import type {
  DirectoryAccessVerification,
  DirectoryConnectionContext,
  DirectoryGroup,
  DirectoryOrganizationalUnit,
  DirectoryProviderClient,
  DirectoryProviderSetupDetails,
  DirectoryUser,
} from "../../directory-sync.types";

type FakeDirectoryUser = FakeDirectoryWorkspace["users"][number];

/**
 * Development-only stand-in for Google Workspace. Reads users, org units and groups from the
 * JSON file named by DIRECTORY_SYNC_FAKE_DIRECTORY on every call, so editing the file and
 * clicking Sync now shows how the sync reacts. It mirrors the Google client: suspended users,
 * org unit and group scopes, nested groups and reporting groups or org units that disappeared.
 */
@Injectable()
export class FakeDirectoryClient implements DirectoryProviderClient {
  static isEnabled() {
    const isLocalEnvironment = !FAKE_DIRECTORY_DISABLED_ENVIRONMENTS.includes(
      process.env.NODE_ENV ?? "",
    );

    return isLocalEnvironment && Boolean(process.env[FAKE_DIRECTORY_FIXTURE_ENV]);
  }

  async getSetupDetails(): Promise<DirectoryProviderSetupDetails> {
    return { clientId: FAKE_DIRECTORY_CLIENT_ID, scopes: GOOGLE_WORKSPACE_DIRECTORY_SCOPES };
  }

  async verifyDirectoryAccess(administratorEmail: string): Promise<DirectoryAccessVerification> {
    const workspace = this.readWorkspace();
    const administrator = workspace.users.find(
      (user) => user.email.toLowerCase() === administratorEmail.toLowerCase() && user.isAdmin,
    );

    if (!administrator) {
      throw new DirectoryProviderAccessDeniedError(
        `${administratorEmail} is not an admin in the fake directory`,
      );
    }

    return { directoryCustomerId: workspace.customerId };
  }

  async listDirectoryUsersInScope(
    connection: DirectoryConnectionContext,
    trackedGroupIds: string[],
    reportProgress: () => Promise<void>,
  ): Promise<DirectoryUser[]> {
    const workspace = this.readWorkspace();
    const missingExternalIds = new Set<string>();

    const listGroupMemberUserIds = (groupId: string) => {
      const memberUserIds = collectGroupMemberUserIds(workspace, groupId);

      if (!memberUserIds) missingExternalIds.add(groupId);

      return memberUserIds ?? new Set<string>();
    };

    const usersInScope = this.filterUsersToScope(
      workspace,
      connection,
      listGroupMemberUserIds,
      missingExternalIds,
    );

    const trackedGroupMembers = trackedGroupIds.map((groupId) => ({
      groupId,
      memberUserIds: listGroupMemberUserIds(groupId),
    }));

    await reportProgress();

    if (missingExternalIds.size) {
      throw new DirectoryObjectsNotFoundError(Array.from(missingExternalIds));
    }

    return usersInScope.map((user) => ({
      externalId: user.id,
      email: user.email.toLowerCase(),
      firstName: user.firstName,
      lastName: user.lastName,
      isSuspended: Boolean(user.suspended),
      groupExternalIds: trackedGroupMembers
        .filter(({ memberUserIds }) => memberUserIds.has(user.id))
        .map(({ groupId }) => groupId),
    }));
  }

  async listOrganizationalUnits(): Promise<DirectoryOrganizationalUnit[]> {
    return this.readWorkspace().orgUnits.map((organizationalUnit) => ({
      externalId: organizationalUnit.id,
      path: organizationalUnit.path,
      name: organizationalUnit.name,
    }));
  }

  async searchDirectoryGroups(
    _connection: DirectoryConnectionContext,
    searchPhrase: string,
  ): Promise<DirectoryGroup[]> {
    const normalizedSearchPhrase = searchPhrase.trim().toLowerCase();

    return this.readWorkspace()
      .groups.filter((group) => group.email.toLowerCase().includes(normalizedSearchPhrase))
      .map((group) => ({ externalId: group.id, email: group.email, name: group.name }));
  }

  private filterUsersToScope(
    workspace: FakeDirectoryWorkspace,
    connection: DirectoryConnectionContext,
    listGroupMemberUserIds: (groupId: string) => Set<string>,
    missingExternalIds: Set<string>,
  ): FakeDirectoryUser[] {
    return match(connection.scopeType)
      .with(DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS, () => workspace.users)
      .with(DIRECTORY_SYNC_SCOPE_TYPES.ORGANIZATIONAL_UNITS, () => {
        const scopePaths = connection.scopeExternalIds.flatMap((organizationalUnitId) => {
          const organizationalUnit = workspace.orgUnits.find(
            (candidate) => candidate.id === organizationalUnitId,
          );

          if (!organizationalUnit) missingExternalIds.add(organizationalUnitId);

          return organizationalUnit ? [organizationalUnit.path] : [];
        });

        return workspace.users.filter((user) =>
          scopePaths.some((scopePath) =>
            isOrganizationalUnitPathWithin(user.orgUnitPath, scopePath),
          ),
        );
      })
      .with(DIRECTORY_SYNC_SCOPE_TYPES.GROUPS, () => {
        const scopeMemberUserIds = new Set(
          connection.scopeExternalIds.flatMap((groupId) => [...listGroupMemberUserIds(groupId)]),
        );

        return workspace.users.filter((user) => scopeMemberUserIds.has(user.id));
      })
      .exhaustive();
  }

  private readWorkspace(): FakeDirectoryWorkspace {
    return readFakeDirectoryWorkspace(String(process.env[FAKE_DIRECTORY_FIXTURE_ENV]));
  }
}

/** Direct and nested members, like Google's derived membership. Null when the group is gone. */
function collectGroupMemberUserIds(
  workspace: FakeDirectoryWorkspace,
  groupId: string,
  visitedGroupIds = new Set<string>(),
): Set<string> | null {
  const group = workspace.groups.find((candidate) => candidate.id === groupId);

  if (!group) return null;

  visitedGroupIds.add(groupId);

  const nestedMemberUserIds = (group.memberGroupIds ?? [])
    .filter((nestedGroupId) => !visitedGroupIds.has(nestedGroupId))
    .flatMap((nestedGroupId) => [
      ...(collectGroupMemberUserIds(workspace, nestedGroupId, visitedGroupIds) ?? []),
    ]);

  return new Set([...group.memberUserIds, ...nestedMemberUserIds]);
}
