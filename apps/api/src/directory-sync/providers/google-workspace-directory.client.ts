import { admin, auth, type admin_directory_v1 } from "@googleapis/admin";
import { Injectable, NotFoundException } from "@nestjs/common";
import { DIRECTORY_SYNC_SCOPE_TYPES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { match } from "ts-pattern";

import { DIRECTORY_SYNC_SECRETS } from "src/env/env.config";
import { EnvService } from "src/env/services/env.service";

import {
  DirectoryProviderAccessDeniedError,
  DirectoryProviderNotConfiguredError,
  DirectoryObjectsNotFoundError,
} from "../directory-sync.errors";
import { isOrganizationalUnitPathWithin } from "../utils/is-organizational-unit-path-within";
import {
  parseGoogleServiceAccountKey,
  type GoogleServiceAccountKey,
} from "../utils/parse-google-service-account-key";

import {
  GOOGLE_WORKSPACE_ACCESS_DENIED_STATUSES,
  GOOGLE_WORKSPACE_DIRECTORY_SCOPES,
  GOOGLE_WORKSPACE_GROUP_SEARCH_DISALLOWED_CHARACTERS,
  GOOGLE_WORKSPACE_MEMBER_TYPES,
  GOOGLE_WORKSPACE_NOT_FOUND_STATUS,
  GOOGLE_WORKSPACE_PAGE_SIZE,
} from "./google-workspace-directory.constants";
import { googleApiErrorWithStatusSchema } from "./google-workspace-directory.schema";

import type {
  DirectoryAccessVerification,
  DirectoryConnectionContext,
  DirectoryGroup,
  DirectoryOrganizationalUnit,
  DirectoryProviderClient,
  DirectoryProviderSetupDetails,
  DirectoryUser,
} from "../directory-sync.types";
type GoogleDirectoryApi = admin_directory_v1.Admin;
type GoogleDirectoryUser = admin_directory_v1.Schema$User;

@Injectable()
export class GoogleWorkspaceDirectoryClient implements DirectoryProviderClient {
  constructor(private readonly envService: EnvService) {}

  async getSetupDetails(): Promise<DirectoryProviderSetupDetails> {
    const serviceAccountKey = await this.readServiceAccountKey();

    return { clientId: serviceAccountKey.client_id, scopes: GOOGLE_WORKSPACE_DIRECTORY_SCOPES };
  }

  async verifyDirectoryAccess(administratorEmail: string): Promise<DirectoryAccessVerification> {
    const directoryApi = await this.createDirectoryApi(administratorEmail);

    const { data: administrator } = await this.callGoogleDirectory(() =>
      directoryApi.users.get({ userKey: administratorEmail, fields: "customerId" }),
    );

    if (!administrator.customerId) {
      throw new DirectoryProviderAccessDeniedError(
        "Google Workspace did not return a customer ID for the administrator",
      );
    }

    return { directoryCustomerId: administrator.customerId };
  }

  /**
   * Lists every user of the Workspace once, then narrows it to the connection scope.
   * Group memberships are resolved only for tracked groups (role and group mappings), and each
   * group is read once. Every scope or tracked group or org unit that no longer exists is
   * collected and reported together, so a deleted group fails the run instead of silently
   * stripping roles or archiving its members.
   */
  async listDirectoryUsersInScope(
    connection: DirectoryConnectionContext,
    trackedGroupIds: string[],
    reportProgress: () => Promise<void>,
  ): Promise<DirectoryUser[]> {
    const directoryApi = await this.createDirectoryApi(connection.administratorEmail);
    const missingExternalIds = new Set<string>();
    const memberUserIdsByGroupId = new Map<string, string[]>();

    const loadGroupMemberUserIds = async (groupId: string) => {
      const knownMemberUserIds = memberUserIdsByGroupId.get(groupId);

      if (knownMemberUserIds) return knownMemberUserIds;

      const memberUserIds = await this.listGroupMemberUserIds(directoryApi, groupId);
      await reportProgress();

      if (!memberUserIds) {
        missingExternalIds.add(groupId);
        return [];
      }

      memberUserIdsByGroupId.set(groupId, memberUserIds);

      return memberUserIds;
    };

    const googleUsers = await this.listAllGoogleUsers(
      directoryApi,
      connection.directoryCustomerId,
      reportProgress,
    );
    const googleUsersInScope = await this.filterGoogleUsersToScope(
      connection,
      googleUsers,
      loadGroupMemberUserIds,
      missingExternalIds,
    );
    const trackedGroupIdsByMemberUserId = await this.collectGroupIdsByMemberUserId(
      trackedGroupIds,
      loadGroupMemberUserIds,
    );

    if (missingExternalIds.size) {
      throw new DirectoryObjectsNotFoundError(Array.from(missingExternalIds));
    }

    return googleUsersInScope.flatMap((googleUser) => {
      const directoryUser = this.toDirectoryUser(
        googleUser,
        trackedGroupIdsByMemberUserId.get(googleUser.id ?? "") ?? [],
      );

      return directoryUser ? [directoryUser] : [];
    });
  }

  async listOrganizationalUnits(
    connection: DirectoryConnectionContext,
  ): Promise<DirectoryOrganizationalUnit[]> {
    const directoryApi = await this.createDirectoryApi(connection.administratorEmail);

    const { data } = await this.callGoogleDirectory(() =>
      directoryApi.orgunits.list({
        customerId: connection.directoryCustomerId,
        type: "all",
        fields: "organizationUnits(orgUnitId,orgUnitPath,name)",
      }),
    );

    return (data.organizationUnits ?? []).flatMap((organizationalUnit) => {
      if (!organizationalUnit.orgUnitId || !organizationalUnit.orgUnitPath) return [];

      return [
        {
          externalId: organizationalUnit.orgUnitId,
          path: organizationalUnit.orgUnitPath,
          name: organizationalUnit.name ?? organizationalUnit.orgUnitPath,
        },
      ];
    });
  }

  async searchDirectoryGroups(
    connection: DirectoryConnectionContext,
    searchPhrase: string,
  ): Promise<DirectoryGroup[]> {
    const directoryApi = await this.createDirectoryApi(connection.administratorEmail);
    const sanitizedSearchPhrase = searchPhrase.replace(
      GOOGLE_WORKSPACE_GROUP_SEARCH_DISALLOWED_CHARACTERS,
      "",
    );

    const { data } = await this.callGoogleDirectory(() =>
      directoryApi.groups.list({
        customer: connection.directoryCustomerId,
        query: sanitizedSearchPhrase ? `email:${sanitizedSearchPhrase}*` : undefined,
        maxResults: GOOGLE_WORKSPACE_PAGE_SIZE.GROUP_SEARCH,
        fields: "groups(id,email,name)",
      }),
    );

    return (data.groups ?? []).flatMap((group) => {
      if (!group.id || !group.email) return [];

      return [{ externalId: group.id, email: group.email, name: group.name ?? group.email }];
    });
  }

  private async listAllGoogleUsers(
    directoryApi: GoogleDirectoryApi,
    customerId: string,
    reportProgress: () => Promise<void>,
  ) {
    const googleUsers: GoogleDirectoryUser[] = [];
    let pageToken: string | undefined;

    do {
      const { data } = await this.callGoogleDirectory(() =>
        directoryApi.users.list({
          customer: customerId,
          maxResults: GOOGLE_WORKSPACE_PAGE_SIZE.USERS,
          pageToken,
          projection: "basic",
          fields:
            "nextPageToken,users(id,primaryEmail,name(givenName,familyName),suspended,archived,orgUnitPath)",
        }),
      );

      googleUsers.push(...(data.users ?? []));
      pageToken = data.nextPageToken ?? undefined;
      await reportProgress();
    } while (pageToken);

    return googleUsers;
  }

  private async filterGoogleUsersToScope(
    connection: DirectoryConnectionContext,
    googleUsers: GoogleDirectoryUser[],
    loadGroupMemberUserIds: (groupId: string) => Promise<string[]>,
    missingExternalIds: Set<string>,
  ) {
    return match(connection.scopeType)
      .with(DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS, async () => googleUsers)
      .with(DIRECTORY_SYNC_SCOPE_TYPES.ORGANIZATIONAL_UNITS, async () => {
        const scopePaths = await this.resolveOrganizationalUnitPaths(
          connection,
          missingExternalIds,
        );

        return googleUsers.filter((googleUser) =>
          scopePaths.some((scopePath) =>
            isOrganizationalUnitPathWithin(googleUser.orgUnitPath ?? "", scopePath),
          ),
        );
      })
      .with(DIRECTORY_SYNC_SCOPE_TYPES.GROUPS, async () => {
        const scopeMemberUserIds = new Set<string>();

        for (const groupId of connection.scopeExternalIds) {
          const memberUserIds = await loadGroupMemberUserIds(groupId);
          memberUserIds.forEach((memberUserId) => scopeMemberUserIds.add(memberUserId));
        }

        return googleUsers.filter((googleUser) => scopeMemberUserIds.has(googleUser.id ?? ""));
      })
      .exhaustive();
  }

  /**
   * Scope stores org unit IDs, which survive renames; paths are resolved fresh on every run.
   * A deleted org unit is reported as missing instead of archiving everyone who was in it.
   */
  private async resolveOrganizationalUnitPaths(
    connection: DirectoryConnectionContext,
    missingExternalIds: Set<string>,
  ) {
    const organizationalUnits = await this.listOrganizationalUnits(connection);
    const pathsByExternalId = new Map(
      organizationalUnits.map((organizationalUnit) => [
        organizationalUnit.externalId,
        organizationalUnit.path,
      ]),
    );

    return connection.scopeExternalIds.flatMap((externalId) => {
      const path = pathsByExternalId.get(externalId);

      if (!path) {
        missingExternalIds.add(externalId);
        return [];
      }

      return [path];
    });
  }

  private async collectGroupIdsByMemberUserId(
    groupIds: string[],
    loadGroupMemberUserIds: (groupId: string) => Promise<string[]>,
  ) {
    const groupIdsByMemberUserId = new Map<string, string[]>();

    for (const groupId of groupIds) {
      const memberUserIds = await loadGroupMemberUserIds(groupId);

      for (const memberUserId of memberUserIds) {
        const memberGroupIds = groupIdsByMemberUserId.get(memberUserId) ?? [];
        groupIdsByMemberUserId.set(memberUserId, [...memberGroupIds, groupId]);
      }
    }

    return groupIdsByMemberUserId;
  }

  /** Returns null when the group no longer exists in the directory. */
  private async listGroupMemberUserIds(
    directoryApi: GoogleDirectoryApi,
    groupId: string,
  ): Promise<string[] | null> {
    const memberUserIds: string[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.callGoogleDirectory(() =>
        directoryApi.members.list({
          groupKey: groupId,
          includeDerivedMembership: true,
          maxResults: GOOGLE_WORKSPACE_PAGE_SIZE.GROUP_MEMBERS,
          pageToken,
          fields: "nextPageToken,members(id,type)",
        }),
      ).catch((error: unknown) => {
        if (hasGoogleApiStatus(error, GOOGLE_WORKSPACE_NOT_FOUND_STATUS)) return null;
        throw error;
      });

      if (!response) return null;

      const { data } = response;

      for (const member of data.members ?? []) {
        if (member.id && member.type === GOOGLE_WORKSPACE_MEMBER_TYPES.USER) {
          memberUserIds.push(member.id);
        }
      }

      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    return memberUserIds;
  }

  private toDirectoryUser(
    googleUser: GoogleDirectoryUser,
    groupExternalIds: string[],
  ): DirectoryUser | null {
    if (!googleUser.id || !googleUser.primaryEmail) return null;

    return {
      externalId: googleUser.id,
      email: googleUser.primaryEmail.toLowerCase(),
      firstName: googleUser.name?.givenName ?? "",
      lastName: googleUser.name?.familyName ?? "",
      isSuspended: Boolean(googleUser.suspended) || Boolean(googleUser.archived),
      groupExternalIds,
    };
  }

  private async createDirectoryApi(administratorEmail: string) {
    const serviceAccountKey = await this.readServiceAccountKey();

    const delegatedCredentials = new auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: GOOGLE_WORKSPACE_DIRECTORY_SCOPES,
      subject: administratorEmail,
    });

    return admin({ version: "directory_v1", auth: delegatedCredentials });
  }

  /**
   * Each tenant brings its own service account, stored encrypted as a tenant secret in admin envs.
   */
  private async readServiceAccountKey(): Promise<GoogleServiceAccountKey> {
    const serializedServiceAccountKey = await this.envService
      .getEnv(DIRECTORY_SYNC_SECRETS.GOOGLE_SERVICE_ACCOUNT_KEY)
      .then((secret) => secret.value)
      .catch((error: unknown) => {
        if (error instanceof NotFoundException) return null;
        throw error;
      });

    if (!serializedServiceAccountKey) {
      throw new DirectoryProviderNotConfiguredError(
        "Google Workspace service account key is not configured for this tenant",
      );
    }

    const serviceAccountKey = parseGoogleServiceAccountKey(serializedServiceAccountKey);

    if (!serviceAccountKey) {
      throw new DirectoryProviderNotConfiguredError(
        "Google Workspace service account key stored for this tenant is not valid",
      );
    }

    return serviceAccountKey;
  }

  private async callGoogleDirectory<TResponse>(request: () => Promise<TResponse>) {
    try {
      return await request();
    } catch (error) {
      if (
        Value.Check(googleApiErrorWithStatusSchema, error) &&
        GOOGLE_WORKSPACE_ACCESS_DENIED_STATUSES.includes(error.response.status)
      ) {
        throw new DirectoryProviderAccessDeniedError(
          `Google Workspace denied directory access with status ${error.response.status}`,
        );
      }

      throw error;
    }
  }
}

function hasGoogleApiStatus(error: unknown, status: number) {
  return Value.Check(googleApiErrorWithStatusSchema, error) && error.response.status === status;
}
