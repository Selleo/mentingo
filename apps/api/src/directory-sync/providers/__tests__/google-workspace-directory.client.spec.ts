import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DIRECTORY_SYNC_SCOPE_TYPES, type DirectorySyncScopeType } from "@repo/shared";

import { EnvService } from "src/env/services/env.service";

import {
  DirectoryObjectsNotFoundError,
  DirectoryProviderAccessDeniedError,
  DirectoryProviderNotConfiguredError,
} from "../../directory-sync.errors";
import { GoogleWorkspaceDirectoryClient } from "../google-workspace-directory.client";

import {
  ADMINISTRATOR_EMAIL,
  DIRECTORY_CUSTOMER_ID,
  FAKE_PAGE_SIZE,
  GOOGLE_GROUP_MEMBERS,
  GOOGLE_ORGANIZATIONAL_UNITS,
  GOOGLE_USERS,
  MISSING_OBJECT_CASES,
  SCOPE_CASES,
  SERVICE_ACCOUNT_KEY_CASES,
  VALID_SERVICE_ACCOUNT_KEY,
} from "./google-workspace-directory.client.scenarios";

const mockDirectoryApi = {
  users: { list: jest.fn() },
  orgunits: { list: jest.fn() },
  members: { list: jest.fn() },
};

jest.mock("@googleapis/admin", () => ({
  admin: () => mockDirectoryApi,
  auth: { JWT: jest.fn() },
}));

describe("GoogleWorkspaceDirectoryClient", () => {
  let googleWorkspaceDirectoryClient: GoogleWorkspaceDirectoryClient;
  const envService = { getEnv: jest.fn() };
  const reportProgress = jest.fn();

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      providers: [GoogleWorkspaceDirectoryClient, { provide: EnvService, useValue: envService }],
    }).compile();

    googleWorkspaceDirectoryClient = testingModule.get(GoogleWorkspaceDirectoryClient);
  });

  beforeEach(() => {
    envService.getEnv.mockReset();
    envService.getEnv.mockResolvedValue({ value: VALID_SERVICE_ACCOUNT_KEY });
    reportProgress.mockReset();
    reportProgress.mockResolvedValue(undefined);
    mockDirectoryApi.users.list.mockReset();
    mockDirectoryApi.users.list.mockImplementation(({ pageToken }) =>
      Promise.resolve({ data: readPage(GOOGLE_USERS, pageToken, "users") }),
    );
    mockDirectoryApi.orgunits.list.mockReset();
    mockDirectoryApi.orgunits.list.mockResolvedValue({
      data: { organizationUnits: GOOGLE_ORGANIZATIONAL_UNITS },
    });
    mockDirectoryApi.members.list.mockReset();
    mockDirectoryApi.members.list.mockImplementation(({ groupKey, pageToken }) => {
      const members = GOOGLE_GROUP_MEMBERS[groupKey];

      if (!members) return Promise.reject({ response: { status: 404 } });

      return Promise.resolve({ data: readPage(members, pageToken, "members") });
    });
  });

  describe("listing users in scope", () => {
    it.each(SCOPE_CASES)("$title", async ({ scopeType, scopeExternalIds, expectedExternalIds }) => {
      const directoryUsers = await listDirectoryUsers(scopeType, [...scopeExternalIds], []);

      expect(directoryUsers.map((directoryUser) => directoryUser.externalId)).toEqual(
        expectedExternalIds,
      );
    });

    it("maps Google users and marks suspended or archived users as suspended", async () => {
      const directoryUsers = await listDirectoryUsers(
        DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS,
        [],
        ["g-sales"],
      );

      expect(directoryUsers.slice(0, 3)).toEqual([
        {
          externalId: "u-anna",
          email: "anna@workspace.test",
          firstName: "Anna",
          lastName: "Sales",
          isSuspended: false,
          groupExternalIds: ["g-sales"],
        },
        expect.objectContaining({ externalId: "u-bob", isSuspended: true }),
        expect.objectContaining({ externalId: "u-cara", isSuspended: true, groupExternalIds: [] }),
      ]);
    });

    it("reads the members of a group once when it is both in scope and mapped", async () => {
      await listDirectoryUsers(DIRECTORY_SYNC_SCOPE_TYPES.GROUPS, ["g-sales"], ["g-sales"]);

      const pageCount = Math.ceil(GOOGLE_GROUP_MEMBERS["g-sales"].length / FAKE_PAGE_SIZE);
      expect(mockDirectoryApi.members.list).toHaveBeenCalledTimes(pageCount);
    });

    it("reports progress for every page it reads", async () => {
      await listDirectoryUsers(DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS, [], ["g-sales"]);

      const userPageCount = Math.ceil(GOOGLE_USERS.length / FAKE_PAGE_SIZE);
      expect(reportProgress).toHaveBeenCalledTimes(userPageCount + 1);
    });
  });

  describe("missing directory objects", () => {
    it.each(MISSING_OBJECT_CASES)(
      "$title",
      async ({ scopeType, scopeExternalIds, trackedGroupIds, expectedMissingExternalIds }) => {
        await expect(
          listDirectoryUsers(scopeType, [...scopeExternalIds], [...trackedGroupIds]),
        ).rejects.toEqual(new DirectoryObjectsNotFoundError([...expectedMissingExternalIds]));
      },
    );
  });

  describe("access", () => {
    it("reports denied access when Google refuses the delegated administrator", async () => {
      mockDirectoryApi.users.list.mockRejectedValue({ response: { status: 403 } });

      await expect(
        listDirectoryUsers(DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS, [], []),
      ).rejects.toBeInstanceOf(DirectoryProviderAccessDeniedError);
    });

    it.each(SERVICE_ACCOUNT_KEY_CASES)(
      "reports a missing configuration when the tenant's key $title",
      async ({ storedKey }) => {
        envService.getEnv.mockImplementation(() =>
          storedKey
            ? Promise.resolve({ value: storedKey })
            : Promise.reject(new NotFoundException()),
        );

        await expect(
          listDirectoryUsers(DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS, [], []),
        ).rejects.toBeInstanceOf(DirectoryProviderNotConfiguredError);
        expect(mockDirectoryApi.users.list).not.toHaveBeenCalled();
      },
    );
  });

  const listDirectoryUsers = (
    scopeType: DirectorySyncScopeType,
    scopeExternalIds: string[],
    trackedGroupIds: string[],
  ) =>
    googleWorkspaceDirectoryClient.listDirectoryUsersInScope(
      {
        administratorEmail: ADMINISTRATOR_EMAIL,
        directoryCustomerId: DIRECTORY_CUSTOMER_ID,
        scopeType,
        scopeExternalIds,
      },
      trackedGroupIds,
      reportProgress,
    );
});

function readPage<TItem>(items: TItem[], pageToken: string | undefined, key: string) {
  const pageIndex = Number(pageToken ?? 0);
  const pageStart = pageIndex * FAKE_PAGE_SIZE;
  const hasNextPage = pageStart + FAKE_PAGE_SIZE < items.length;

  return {
    [key]: items.slice(pageStart, pageStart + FAKE_PAGE_SIZE),
    nextPageToken: hasNextPage ? String(pageIndex + 1) : undefined,
  };
}
