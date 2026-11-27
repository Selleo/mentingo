import { faker } from "@faker-js/faker";
import {
  DIRECTORY_SYNC_CHANGE_SOURCE,
  DIRECTORY_SYNC_CONNECTION_STATUSES,
  DIRECTORY_SYNC_ERROR_KEYS,
  DIRECTORY_SYNC_RUN_STATUSES,
  DIRECTORY_SYNC_RUN_TRIGGERS,
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  type DirectorySyncRunStatus,
  type SystemRoleSlug,
} from "@repo/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  activityLogs,
  directorySyncRuns,
  groupUsers,
  permissionRoles,
  permissionUserRoles,
  userExternalIdentities,
  users,
  directorySyncConnections,
} from "src/storage/schema";
import { UserService } from "src/user/user.service";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  createDirectorySyncConnectionFactory,
  createDirectorySyncGroupMappingFactory,
  createDirectorySyncRoleMappingFactory,
  createDirectorySyncRunFactory,
  createUserExternalIdentityFactory,
} from "../../../test/factory/directory-sync.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";
import { waitForOutbox } from "../../../test/helpers/wait-for-outbox";
import { DirectoryObjectsNotFoundError } from "../directory-sync.errors";
import { GoogleWorkspaceDirectoryClient } from "../providers/google-workspace-directory.client";
import { DirectorySyncConnectionService } from "../services/directory-sync-connection.service";
import { DirectorySyncRunService } from "../services/directory-sync-run.service";
import { DirectorySyncService } from "../services/directory-sync.service";
import { DirectorySyncCron } from "../workers/directory-sync.cron";

import {
  ACCOUNT_STATES,
  ACCOUNT_SYNC_CASES,
  ARCHIVE_LIMIT_CASES,
  DIRECTORY_STATES,
  DIRECTORY_SYNC_TABLES,
  GOOGLE_ADMINS_GROUP_ID,
  GOOGLE_CREATORS_GROUP_ID,
  GOOGLE_SALES_GROUP_ID,
  LAST_ACTIVE_ADMIN_ERROR_KEY,
  RENAMED_SYNCED_USER_EMAIL,
  ROLE_OVERRIDE_RESTORE_CASES,
  RUN_COMPLETION_TIMEOUT_MILLISECONDS,
  RUN_POLL_INTERVAL_MILLISECONDS,
  SCHEDULE_CASES,
  STALE_RUN_AGE_MILLISECONDS,
  SYNC_STARTER_PASSWORD,
  SYNCED_USER_EMAIL,
  SYNCED_USER_EXTERNAL_ID,
  UNFINISHED_RUN_STATUS_CASES,
  type AccountState,
  type DirectoryState,
} from "./directory-sync.scenarios";

import type { DirectoryUser } from "../directory-sync.types";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { GroupService } from "src/group/group.service";

type DirectorySyncConnection = typeof directorySyncConnections.$inferSelect;

describe("Directory sync (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let defaultTenantId: UUIDType;
  let runAsTenant: <T>(tenantId: string, callback: () => Promise<T>) => Promise<T>;
  let directorySyncService: DirectorySyncService;
  let googleWorkspaceDirectoryClient: GoogleWorkspaceDirectoryClient;
  let listDirectoryUsersInScope: jest.SpyInstance;
  let userService: UserService;
  let groupService: GroupService;
  let directorySyncRunService: DirectorySyncRunService;
  let directorySyncConnectionService: DirectorySyncConnectionService;
  let directorySyncCron: DirectorySyncCron;

  beforeAll(async () => {
    const context = await createE2ETest({ useDbProxy: true, enableActivityLogs: true });
    app = context.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    defaultTenantId = context.defaultTenantId;
    runAsTenant = context.runAsTenant;
    directorySyncService = app.get(DirectorySyncService);
    userService = app.get(UserService);
    const groupServiceModule = await import("src/group/group.service");
    groupService = app.get(groupServiceModule.GroupService);
    directorySyncRunService = app.get(DirectorySyncRunService);
    directorySyncConnectionService = app.get(DirectorySyncConnectionService);
    directorySyncCron = app.get(DirectorySyncCron);
    googleWorkspaceDirectoryClient = app.get(GoogleWorkspaceDirectoryClient);
    listDirectoryUsersInScope = jest.spyOn(
      googleWorkspaceDirectoryClient,
      "listDirectoryUsersInScope",
    );
  });

  beforeEach(async () => {
    await truncateTables(baseDb, [...DIRECTORY_SYNC_TABLES]);
    await runAsTenant(defaultTenantId, () => createSettingsFactory(db).create());
    listDirectoryUsersInScope.mockReset();
    listDirectoryUsersInScope.mockResolvedValue([]);
  });

  afterEach(async () => {
    await truncateTables(baseDb, [...DIRECTORY_SYNC_TABLES]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("accounts", () => {
    it.each(ACCOUNT_SYNC_CASES)("$title", async ({ accountState, directoryState, expected }) => {
      const { connection, syncStarter } = await arrangeConnection();
      await arrangeAccount(connection, accountState);

      const run = await synchronizeDirectory(
        connection,
        directoryUsersFor(directoryState),
        syncStarter.id,
      );

      const accounts = await findAccountsByEmail(SYNCED_USER_EMAIL);
      const [account] = accounts;
      expect(run.status).toBe(DIRECTORY_SYNC_RUN_STATUSES.SUCCEEDED);
      expect({
        accountCount: accounts.length,
        isArchived: account?.archived ?? false,
        isLinked: Boolean(account?.identity),
        archivedByDirectorySync: account?.identity?.archivedByDirectorySync ?? false,
      }).toEqual(expected);
    });

    it("keeps the same account when the email changes in Google", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
      });

      await synchronizeDirectory(
        connection,
        [buildDirectoryUser({ email: RENAMED_SYNCED_USER_EMAIL })],
        syncStarter.id,
      );

      expect(await findAccountsByEmail(RENAMED_SYNCED_USER_EMAIL)).toEqual([]);
      expect(await findAccountsByEmail(SYNCED_USER_EMAIL)).toMatchObject([
        { id: account.id, archived: false },
      ]);
    });

    it("does not overwrite the name of an existing account", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
      });

      await synchronizeDirectory(
        connection,
        [buildDirectoryUser({ firstName: "Renamed", lastName: "InGoogle" })],
        syncStarter.id,
      );

      expect(await findUserName(account.id)).toEqual({
        firstName: account.firstName,
        lastName: account.lastName,
      });
    });
  });

  describe("roles", () => {
    it("gives members of a mapped Google group the mapped role", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      await arrangeRoleMapping(
        connection,
        GOOGLE_CREATORS_GROUP_ID,
        SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        0,
      );

      await synchronizeDirectory(
        connection,
        [buildDirectoryUser({ groupExternalIds: [GOOGLE_CREATORS_GROUP_ID] })],
        syncStarter.id,
      );

      const [account] = await findAccountsByEmail(SYNCED_USER_EMAIL);
      expect(await findRoleSlugs(account.id)).toEqual([SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]);
    });

    it("lets the higher group decide when a user is in several mapped groups", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      await arrangeRoleMapping(connection, GOOGLE_ADMINS_GROUP_ID, SYSTEM_ROLE_SLUGS.ADMIN, 0);
      await arrangeRoleMapping(
        connection,
        GOOGLE_CREATORS_GROUP_ID,
        SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        1,
      );

      await synchronizeDirectory(
        connection,
        [
          buildDirectoryUser({
            groupExternalIds: [GOOGLE_CREATORS_GROUP_ID, GOOGLE_ADMINS_GROUP_ID],
          }),
        ],
        syncStarter.id,
      );

      const [account] = await findAccountsByEmail(SYNCED_USER_EMAIL);
      expect(await findRoleSlugs(account.id)).toEqual([SYSTEM_ROLE_SLUGS.ADMIN]);
    });

    it("leaves the roles of a manually overridden user alone", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
        rolesOverridden: true,
        roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      });

      await synchronizeDirectory(connection, [buildDirectoryUser()], syncStarter.id);

      expect(await findRoleSlugs(account.id)).toEqual([SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]);
    });

    it("keeps the sync starter's admin role and marks it as overridden", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      await runAsTenant(defaultTenantId, () =>
        createUserExternalIdentityFactory(db).create({
          tenantId: defaultTenantId,
          userId: syncStarter.id,
          connectionId: connection.id,
          externalId: "google-user-starter",
        }),
      );

      await synchronizeDirectory(
        connection,
        [buildDirectoryUser({ externalId: "google-user-starter", email: syncStarter.email })],
        syncStarter.id,
      );

      expect(await findRoleSlugs(syncStarter.id)).toEqual([SYSTEM_ROLE_SLUGS.ADMIN]);
      expect(await findIdentity(syncStarter.id)).toMatchObject({ rolesOverridden: true });
    });

    it("gives a user in no mapped group the connection's default role", async () => {
      const { connection, syncStarter } = await arrangeConnection({
        defaultRoleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      });

      await synchronizeDirectory(connection, [buildDirectoryUser()], syncStarter.id);

      const [account] = await findAccountsByEmail(SYNCED_USER_EMAIL);
      expect(await findRoleSlugs(account.id)).toEqual([SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]);
    });

    it("applies the directory roles again once an admin restores them", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      await arrangeRoleMapping(
        connection,
        GOOGLE_CREATORS_GROUP_ID,
        SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        0,
      );
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
        rolesOverridden: true,
      });

      await runAsTenant(defaultTenantId, () =>
        directorySyncConnectionService.restoreDirectoryRoles(account.id),
      );
      await synchronizeDirectory(
        connection,
        [buildDirectoryUser({ groupExternalIds: [GOOGLE_CREATORS_GROUP_ID] })],
        syncStarter.id,
      );

      expect(await findRoleSlugs(account.id)).toEqual([SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]);
      expect(await findIdentity(account.id)).toMatchObject({ rolesOverridden: false });
    });
  });

  describe("group membership", () => {
    it("adds synced users to the mapped group and keeps members added by hand", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const manualMember = await runAsTenant(defaultTenantId, () =>
        createUserFactory(db).create({ tenantId: defaultTenantId }),
      );
      const group = await arrangeMappedGroup(connection, GOOGLE_SALES_GROUP_ID, [manualMember.id]);

      await synchronizeDirectory(
        connection,
        [buildDirectoryUser({ groupExternalIds: [GOOGLE_SALES_GROUP_ID] })],
        syncStarter.id,
      );

      const [account] = await findAccountsByEmail(SYNCED_USER_EMAIL);
      expect(await findGroupMemberIds(group.id)).toEqual([account.id, manualMember.id].sort());
    });

    it("removes synced users who left the scope from mapped groups", async () => {
      const { connection, syncStarter } = await arrangeConnection({
        archiveUsersOutsideScope: false,
      });
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
      });
      const group = await arrangeMappedGroup(connection, GOOGLE_SALES_GROUP_ID, [account.id]);

      await synchronizeDirectory(
        connection,
        directoryUsersFor(DIRECTORY_STATES.MISSING),
        syncStarter.id,
      );

      expect(await findGroupMemberIds(group.id)).toEqual([]);
      expect(await findAccountsByEmail(SYNCED_USER_EMAIL)).toMatchObject([{ archived: false }]);
    });
  });

  describe("safeguards", () => {
    it("stops the run when the directory returns no users", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      await arrangeLinkedAccount(connection, { archived: false, archivedByDirectorySync: false });

      const run = await synchronizeDirectory(connection, [], syncStarter.id);

      expect(run.status).toBe(DIRECTORY_SYNC_RUN_STATUSES.ABORTED_BY_SAFEGUARD);
      expect(await findAccountsByEmail(SYNCED_USER_EMAIL)).toMatchObject([{ archived: false }]);
    });

    it.each(ARCHIVE_LIMIT_CASES)(
      "$title",
      async ({ archiveLimitPercentage, leaverCount, expected }) => {
        const { connection, syncStarter } = await arrangeConnection({ archiveLimitPercentage });
        const leavers = await arrangeLinkedAccounts(connection, leaverCount);

        const run = await synchronizeDirectory(
          connection,
          [
            buildDirectoryUser({
              externalId: "google-user-stayer",
              email: "stayer@workspace.test",
            }),
          ],
          syncStarter.id,
        );

        const archivedLeaverIds = await findArchivedUserIds(leavers.map((leaver) => leaver.id));
        expect({ status: run.status, archivedCount: archivedLeaverIds.length }).toEqual(expected);
      },
    );

    it("fails the run and lists the missing IDs when a mapped Google group was deleted", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      listDirectoryUsersInScope.mockRejectedValue(
        new DirectoryObjectsNotFoundError([GOOGLE_SALES_GROUP_ID]),
      );

      const run = await synchronizeDirectory(connection, null, syncStarter.id);

      expect(run.status).toBe(DIRECTORY_SYNC_RUN_STATUSES.FAILED);
      expect(await findConnection(connection.id)).toMatchObject({
        status: DIRECTORY_SYNC_CONNECTION_STATUSES.FAILING,
        missingExternalIds: [GOOGLE_SALES_GROUP_ID],
      });
    });
  });

  describe("manual changes", () => {
    it("refuses to delete a synced user", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
      });

      await expect(
        runAsTenant(defaultTenantId, () =>
          userService.deleteUser(buildActor(syncStarter), account.id),
        ),
      ).rejects.toMatchObject({ message: DIRECTORY_SYNC_ERROR_KEYS.DIRECTORY_USER_NOT_DELETABLE });
    });

    it("refuses to bulk delete synced users", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
      });

      await expect(
        runAsTenant(defaultTenantId, () =>
          userService.deleteBulkUsers(buildActor(syncStarter), [account.id]),
        ),
      ).rejects.toMatchObject({ message: DIRECTORY_SYNC_ERROR_KEYS.DIRECTORY_USER_NOT_DELETABLE });
    });

    it("marks roles as overridden when an admin changes a synced user's roles", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
      });

      await runAsTenant(defaultTenantId, () =>
        userService.updateUser(
          account.id,
          { roleSlugs: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR] },
          buildActor(syncStarter),
        ),
      );

      expect(await findIdentity(account.id)).toMatchObject({ rolesOverridden: true });
    });

    it("refuses to change a synced user's membership in a mapped group", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
      });
      const group = await arrangeMappedGroup(connection, GOOGLE_SALES_GROUP_ID, []);

      await expect(
        runAsTenant(defaultTenantId, () =>
          groupService.setUserGroups([group.id], account.id, { actor: buildActor(syncStarter) }),
        ),
      ).rejects.toMatchObject({
        message: DIRECTORY_SYNC_ERROR_KEYS.GROUP_MEMBERSHIP_MANAGED_BY_DIRECTORY,
      });
    });

    it("refuses to delete a mapped group", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const group = await arrangeMappedGroup(connection, GOOGLE_SALES_GROUP_ID, []);

      await expect(
        runAsTenant(defaultTenantId, () =>
          groupService.deleteGroup(group.id, buildActor(syncStarter)),
        ),
      ).rejects.toMatchObject({ message: DIRECTORY_SYNC_ERROR_KEYS.MAPPED_GROUP_NOT_DELETABLE });
    });

    it("refuses to bulk delete mapped groups", async () => {
      const { connection } = await arrangeConnection();
      const group = await arrangeMappedGroup(connection, GOOGLE_SALES_GROUP_ID, []);

      await expect(
        runAsTenant(defaultTenantId, () => groupService.bulkDeleteGroups([group.id])),
      ).rejects.toMatchObject({ message: DIRECTORY_SYNC_ERROR_KEYS.MAPPED_GROUP_NOT_DELETABLE });
    });

    it("refuses to archive the last active admin", async () => {
      const { syncStarter } = await arrangeConnection();

      await expect(
        runAsTenant(defaultTenantId, () =>
          userService.updateUser(syncStarter.id, { archived: true }, buildActor(syncStarter)),
        ),
      ).rejects.toMatchObject({ message: LAST_ACTIVE_ADMIN_ERROR_KEY });
    });
  });

  describe("runs", () => {
    it("refuses a second sync while one is queued", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      await arrangeUnfinishedRun(connection, DIRECTORY_SYNC_RUN_STATUSES.QUEUED);

      await expect(
        runAsTenant(defaultTenantId, () =>
          directorySyncRunService.requestManualDirectorySync(connection.id, syncStarter.id),
        ),
      ).rejects.toMatchObject({ message: DIRECTORY_SYNC_ERROR_KEYS.SYNC_ALREADY_IN_PROGRESS });
    });

    it.each(UNFINISHED_RUN_STATUS_CASES)(
      "refuses to disconnect while a sync is $runStatus",
      async ({ runStatus }) => {
        const { connection } = await arrangeConnection();
        await arrangeUnfinishedRun(connection, runStatus);

        await expect(
          runAsTenant(defaultTenantId, () =>
            directorySyncConnectionService.deleteConnection(connection.provider),
          ),
        ).rejects.toMatchObject({ message: DIRECTORY_SYNC_ERROR_KEYS.DISCONNECT_WHILE_SYNCING });
      },
    );

    it("stops writing when its run is closed while it reads the directory", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      listDirectoryUsersInScope.mockImplementation(async () => {
        await closeUnfinishedRuns(connection.id);

        return [buildDirectoryUser()];
      });

      const run = await synchronizeDirectory(connection, null, syncStarter.id);

      expect(run.status).toBe(DIRECTORY_SYNC_RUN_STATUSES.FAILED);
      expect(await findAccountsByEmail(SYNCED_USER_EMAIL)).toEqual([]);
    });

    it("closes a run without progress for two hours before queuing a new one", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const staleRun = await arrangeUnfinishedRun(
        connection,
        DIRECTORY_SYNC_RUN_STATUSES.RUNNING,
        new Date(Date.now() - STALE_RUN_AGE_MILLISECONDS).toISOString(),
      );
      listDirectoryUsersInScope.mockResolvedValue([buildDirectoryUser()]);

      const queuedRun = await runAsTenant(defaultTenantId, () =>
        directorySyncRunService.requestManualDirectorySync(connection.id, syncStarter.id),
      );

      expect(await findRun(staleRun.id)).toMatchObject({
        status: DIRECTORY_SYNC_RUN_STATUSES.FAILED,
      });
      expect(await waitForRunToFinish(queuedRun.id)).toMatchObject({
        status: DIRECTORY_SYNC_RUN_STATUSES.SUCCEEDED,
      });
    });

    it("runs a sync requested over HTTP through the queue", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      listDirectoryUsersInScope.mockResolvedValue([buildDirectoryUser()]);
      const cookie = await cookieFor(syncStarter, app);

      const response = await request(app.getHttpServer())
        .post(`/api/directory-sync/${connection.provider}/connection/synchronizations`)
        .set("Cookie", cookie)
        .expect(201);

      const run = await waitForRunToFinish(response.body.data.id);
      expect(run.status).toBe(DIRECTORY_SYNC_RUN_STATUSES.SUCCEEDED);
      expect(await findAccountsByEmail(SYNCED_USER_EMAIL)).toHaveLength(1);
    });
  });

  describe("schedule", () => {
    it.each(SCHEDULE_CASES)(
      "$title",
      async ({ lastSuccessfulSyncAt, expectedScheduledRunCount }) => {
        const { connection } = await arrangeConnection({ lastSuccessfulSyncAt });

        await directorySyncCron.requestScheduledDirectorySyncs();

        const scheduledRuns = await findRunsForConnection(connection.id);
        await Promise.all(scheduledRuns.map((run) => waitForRunToFinish(run.id)));
        expect(
          scheduledRuns.filter((run) => run.trigger === DIRECTORY_SYNC_RUN_TRIGGERS.SCHEDULE),
        ).toHaveLength(expectedScheduledRunCount);
      },
    );
  });

  describe("activity log", () => {
    it("records role changes made by the sync as coming from directory sync", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      await arrangeRoleMapping(
        connection,
        GOOGLE_CREATORS_GROUP_ID,
        SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        0,
      );
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
      });

      await synchronizeDirectory(
        connection,
        [buildDirectoryUser({ groupExternalIds: [GOOGLE_CREATORS_GROUP_ID] })],
        syncStarter.id,
      );
      const activityLogSources = await waitForOutbox(
        app,
        () => findActivityLogSources(account.id),
        (sources) => sources.length > 0,
      );

      expect(activityLogSources).toContain(DIRECTORY_SYNC_CHANGE_SOURCE);
    });

    it("records accounts archived by the sync as coming from directory sync", async () => {
      const { connection, syncStarter } = await arrangeConnection();
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
      });

      await synchronizeDirectory(
        connection,
        directoryUsersFor(DIRECTORY_STATES.SUSPENDED),
        syncStarter.id,
      );
      const activityLogSources = await waitForOutbox(
        app,
        () => findActivityLogSources(account.id),
        (sources) => sources.length > 0,
      );

      expect(activityLogSources).toContain(DIRECTORY_SYNC_CHANGE_SOURCE);
    });
  });

  describe("permissions", () => {
    it("refuses a sync requested by a user without the directory sync permission", async () => {
      const { connection } = await arrangeConnection();
      const student = await arrangeUserWithCredentials(SYSTEM_ROLE_SLUGS.STUDENT);

      await request(app.getHttpServer())
        .post(`/api/directory-sync/${connection.provider}/connection/synchronizations`)
        .set("Cookie", await cookieFor(student, app))
        .expect(403);

      expect(await findRunsForConnection(connection.id)).toEqual([]);
    });

    it.each(ROLE_OVERRIDE_RESTORE_CASES)("$title", async ({ requesterRoleSlug, expected }) => {
      const { connection } = await arrangeConnection();
      const account = await arrangeLinkedAccount(connection, {
        archived: false,
        archivedByDirectorySync: false,
        rolesOverridden: true,
      });
      const requester = await arrangeUserWithCredentials(requesterRoleSlug);

      const response = await request(app.getHttpServer())
        .delete(`/api/directory-sync/users/${account.id}/role-override`)
        .set("Cookie", await cookieFor(requester, app));

      const identity = await findIdentity(account.id);
      expect({ status: response.status, rolesOverridden: identity?.rolesOverridden }).toEqual(
        expected,
      );
    });
  });

  const arrangeConnection = (
    connectionOverrides: Partial<Parameters<typeof connectionFactory.create>[0]> = {},
  ) =>
    runAsTenant(defaultTenantId, async () => {
      const syncStarter = await createUserFactory(db)
        .withCredentials({ password: SYNC_STARTER_PASSWORD })
        .withAdminSettings(db)
        .create({
          tenantId: defaultTenantId,
          email: `starter-${faker.string.alphanumeric(6)}@mentingo.test`,
        });
      const connection = await connectionFactory.create({
        tenantId: defaultTenantId,
        createdByUserId: syncStarter.id,
        ...connectionOverrides,
      });

      return { connection, syncStarter };
    });

  const arrangeAccount = (connection: DirectorySyncConnection, accountState: AccountState) =>
    runAsTenant(defaultTenantId, () =>
      match(accountState)
        .with(ACCOUNT_STATES.NONE, async () => null)
        .with(ACCOUNT_STATES.ACTIVE_UNLINKED, async () =>
          createUserFactory(db).create({
            tenantId: defaultTenantId,
            email: SYNCED_USER_EMAIL.toUpperCase(),
          }),
        )
        .with(ACCOUNT_STATES.LINKED_ACTIVE, async () =>
          arrangeLinkedAccount(connection, { archived: false, archivedByDirectorySync: false }),
        )
        .with(ACCOUNT_STATES.LINKED_ARCHIVED_BY_SYNC, async () =>
          arrangeLinkedAccount(connection, { archived: true, archivedByDirectorySync: true }),
        )
        .with(ACCOUNT_STATES.LINKED_ARCHIVED_MANUALLY, async () =>
          arrangeLinkedAccount(connection, { archived: true, archivedByDirectorySync: false }),
        )
        .exhaustive(),
    );

  const arrangeLinkedAccount = (
    connection: DirectorySyncConnection,
    state: {
      archived: boolean;
      archivedByDirectorySync: boolean;
      rolesOverridden?: boolean;
      roleSlug?: SystemRoleSlug;
    },
    identity: { email: string; externalId: string } = {
      email: SYNCED_USER_EMAIL,
      externalId: SYNCED_USER_EXTERNAL_ID,
    },
  ) =>
    runAsTenant(defaultTenantId, async () => {
      const account = await createUserFactory(db).create({
        tenantId: defaultTenantId,
        email: identity.email,
        archived: state.archived,
        roleSlug: state.roleSlug ?? SYSTEM_ROLE_SLUGS.STUDENT,
      });
      await createUserExternalIdentityFactory(db).create({
        tenantId: defaultTenantId,
        userId: account.id,
        connectionId: connection.id,
        externalId: identity.externalId,
        archivedByDirectorySync: state.archivedByDirectorySync,
        rolesOverridden: state.rolesOverridden ?? false,
      });

      return account;
    });

  const arrangeLinkedAccounts = async (connection: DirectorySyncConnection, count: number) => {
    const accounts = [];

    for (let index = 0; index < count; index++) {
      accounts.push(
        await arrangeLinkedAccount(
          connection,
          { archived: false, archivedByDirectorySync: false },
          { email: `leaver-${index}@workspace.test`, externalId: `google-user-leaver-${index}` },
        ),
      );
    }

    return accounts;
  };

  const arrangeRoleMapping = (
    connection: DirectorySyncConnection,
    externalGroupId: string,
    roleSlug: SystemRoleSlug,
    priority: number,
  ) =>
    runAsTenant(defaultTenantId, () =>
      createDirectorySyncRoleMappingFactory(db).create({
        tenantId: defaultTenantId,
        connectionId: connection.id,
        externalGroupId,
        roleSlug,
        priority,
      }),
    );

  const arrangeMappedGroup = (
    connection: DirectorySyncConnection,
    externalGroupId: string,
    memberIds: UUIDType[],
  ) =>
    runAsTenant(defaultTenantId, async () => {
      const group = await createGroupFactory(db).withMembers(memberIds).create();
      await createDirectorySyncGroupMappingFactory(db).create({
        tenantId: defaultTenantId,
        connectionId: connection.id,
        externalGroupId,
        groupId: group.id,
      });

      return group;
    });

  const arrangeUnfinishedRun = (
    connection: DirectorySyncConnection,
    status: DirectorySyncRunStatus,
    lastActivityAt = new Date().toISOString(),
  ) =>
    runAsTenant(defaultTenantId, () =>
      createDirectorySyncRunFactory(db).create({
        tenantId: defaultTenantId,
        connectionId: connection.id,
        status,
        createdAt: lastActivityAt,
        updatedAt: lastActivityAt,
      }),
    );

  const arrangeUserWithCredentials = (roleSlug: SystemRoleSlug) =>
    runAsTenant(defaultTenantId, () => {
      const userFactory = createUserFactory(db).withCredentials({
        password: SYNC_STARTER_PASSWORD,
      });
      const factoryForRole =
        roleSlug === SYSTEM_ROLE_SLUGS.ADMIN
          ? userFactory.withAdminSettings(db)
          : userFactory.withUserSettings(db);

      return factoryForRole.create({
        tenantId: defaultTenantId,
        email: `${roleSlug}-${faker.string.alphanumeric(6)}@mentingo.test`,
        roleSlug,
      });
    });

  /** Simulates the stale-run cleanup or a disconnect closing the run while the worker is busy. */
  const closeUnfinishedRuns = (connectionId: UUIDType) =>
    baseDb
      .update(directorySyncRuns)
      .set({ status: DIRECTORY_SYNC_RUN_STATUSES.FAILED, finishedAt: new Date().toISOString() })
      .where(
        and(
          eq(directorySyncRuns.connectionId, connectionId),
          inArray(directorySyncRuns.status, [
            DIRECTORY_SYNC_RUN_STATUSES.QUEUED,
            DIRECTORY_SYNC_RUN_STATUSES.RUNNING,
          ]),
        ),
      );

  const directoryUsersFor = (directoryState: DirectoryState): DirectoryUser[] =>
    match(directoryState)
      .with(DIRECTORY_STATES.ACTIVE, () => [buildDirectoryUser()])
      .with(DIRECTORY_STATES.SUSPENDED, () => [buildDirectoryUser({ isSuspended: true })])
      .with(DIRECTORY_STATES.MISSING, () => [
        buildDirectoryUser({ externalId: "google-user-other", email: "other@workspace.test" }),
      ])
      .exhaustive();

  const buildDirectoryUser = (overrides: Partial<DirectoryUser> = {}): DirectoryUser => ({
    externalId: SYNCED_USER_EXTERNAL_ID,
    email: SYNCED_USER_EMAIL,
    firstName: "Anna",
    lastName: "Synced",
    isSuspended: false,
    groupExternalIds: [],
    ...overrides,
  });

  const connectionFactory = {
    create: (
      attributes: Parameters<ReturnType<typeof createDirectorySyncConnectionFactory>["create"]>[0],
    ) => createDirectorySyncConnectionFactory(db).create(attributes),
  };

  /** Runs one sync directly in the tenant, without the queue, against the given directory. */
  const synchronizeDirectory = async (
    connection: DirectorySyncConnection,
    directoryUsers: DirectoryUser[] | null,
    triggeredByUserId: UUIDType,
  ) => {
    if (directoryUsers) listDirectoryUsersInScope.mockResolvedValue(directoryUsers);

    const run = await runAsTenant(defaultTenantId, async () => {
      const queuedRun = await createDirectorySyncRunFactory(db).create({
        tenantId: defaultTenantId,
        connectionId: connection.id,
        triggeredByUserId,
      });
      await directorySyncService.synchronizeDirectoryForRun(queuedRun.id);

      return queuedRun;
    });

    const [finishedRun] = await baseDb
      .select()
      .from(directorySyncRuns)
      .where(eq(directorySyncRuns.id, run.id));

    return finishedRun;
  };

  /** Case-insensitive, so a duplicate created instead of a link would show up as two accounts. */
  const findAccountsByEmail = (email: string) =>
    baseDb
      .select({ id: users.id, archived: users.archived, identity: userExternalIdentities })
      .from(users)
      .leftJoin(userExternalIdentities, eq(userExternalIdentities.userId, users.id))
      .where(eq(sql`lower(${users.email})`, email.toLowerCase()));

  const findUserName = async (userId: UUIDType) => {
    const [user] = await baseDb
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId));

    return user;
  };

  const findActivityLogSources = async (userId: UUIDType) => {
    const logs = await baseDb
      .select({ metadata: activityLogs.metadata })
      .from(activityLogs)
      .where(eq(activityLogs.resourceId, userId));

    return logs.map((log) => log.metadata.context?.source);
  };

  const findRun = async (runId: UUIDType) => {
    const [run] = await baseDb
      .select()
      .from(directorySyncRuns)
      .where(eq(directorySyncRuns.id, runId));

    return run;
  };

  const findRunsForConnection = (connectionId: UUIDType) =>
    baseDb.select().from(directorySyncRuns).where(eq(directorySyncRuns.connectionId, connectionId));

  const findRoleSlugs = async (userId: UUIDType) => {
    const roleRows = await baseDb
      .select({ slug: permissionRoles.slug })
      .from(permissionUserRoles)
      .innerJoin(permissionRoles, eq(permissionRoles.id, permissionUserRoles.roleId))
      .where(eq(permissionUserRoles.userId, userId));

    return roleRows.map((roleRow) => roleRow.slug).sort();
  };

  const findIdentity = async (userId: UUIDType) => {
    const [identity] = await baseDb
      .select()
      .from(userExternalIdentities)
      .where(eq(userExternalIdentities.userId, userId));

    return identity ?? null;
  };

  const findGroupMemberIds = async (groupId: UUIDType) => {
    const memberships = await baseDb
      .select({ userId: groupUsers.userId })
      .from(groupUsers)
      .where(eq(groupUsers.groupId, groupId));

    return memberships.map((membership) => membership.userId).sort();
  };

  const findArchivedUserIds = async (userIds: UUIDType[]) => {
    const archivedUsers = await baseDb
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, userIds), eq(users.archived, true)));

    return archivedUsers.map((archivedUser) => archivedUser.id);
  };

  const findConnection = async (connectionId: UUIDType) => {
    const [connection] = await baseDb
      .select()
      .from(directorySyncConnections)
      .where(eq(directorySyncConnections.id, connectionId));

    return connection;
  };

  /** The worker processes the queued job in the background; poll until the run is finished. */
  const waitForRunToFinish = async (runId: UUIDType) => {
    const deadline = Date.now() + RUN_COMPLETION_TIMEOUT_MILLISECONDS;

    while (Date.now() < deadline) {
      const [run] = await baseDb
        .select()
        .from(directorySyncRuns)
        .where(eq(directorySyncRuns.id, runId));

      if (run?.finishedAt) return run;

      await new Promise((resolve) => setTimeout(resolve, RUN_POLL_INTERVAL_MILLISECONDS));
    }

    throw new Error(`Directory sync run ${runId} did not finish in time`);
  };

  const buildActor = (user: { id: UUIDType; email: string }): CurrentUserType => ({
    userId: user.id,
    email: user.email,
    tenantId: defaultTenantId,
    roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
    permissions: Object.values(PERMISSIONS),
  });
});
