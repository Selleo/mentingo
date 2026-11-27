import { faker } from "@faker-js/faker";
import {
  DIRECTORY_SYNC_CONNECTION_STATUSES,
  DIRECTORY_SYNC_PROVIDERS,
  DIRECTORY_SYNC_RUN_STATUSES,
  DIRECTORY_SYNC_RUN_TRIGGERS,
  DIRECTORY_SYNC_SCOPE_TYPES,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@repo/shared";
import { Factory } from "fishery";

import {
  directorySyncConnections,
  directorySyncGroupMappings,
  directorySyncRoleMappings,
  directorySyncRuns,
  userExternalIdentities,
} from "src/storage/schema";

import {
  ensureSystemRolesForTenantInTests,
  findPermissionRoleIdInTests,
} from "../helpers/permission-role-helpers";
import { ensureTenant } from "../helpers/tenant-helpers";

import type { DatabasePg } from "src/common";

type DirectorySyncConnection = typeof directorySyncConnections.$inferSelect;
type DirectorySyncConnectionAttributes = Omit<
  typeof directorySyncConnections.$inferInsert,
  "defaultRoleId"
> & { defaultRoleSlug: SystemRoleSlug };

/** A verified Google Workspace connection; the default role is given by slug. */
export const createDirectorySyncConnectionFactory = (db: DatabasePg) =>
  Factory.define<DirectorySyncConnectionAttributes, object, DirectorySyncConnection>(
    ({ onCreate }) => {
      onCreate(async ({ defaultRoleSlug, ...connection }) => {
        const tenantId = await ensureTenant(db, connection.tenantId);
        await ensureSystemRolesForTenantInTests(db, tenantId);
        const defaultRoleId = await findPermissionRoleIdInTests(db, tenantId, defaultRoleSlug);

        const [inserted] = await db
          .insert(directorySyncConnections)
          .values({ ...connection, tenantId, defaultRoleId })
          .returning();

        return inserted;
      });

      return {
        provider: DIRECTORY_SYNC_PROVIDERS.GOOGLE_WORKSPACE,
        status: DIRECTORY_SYNC_CONNECTION_STATUSES.ACTIVE,
        administratorEmail: "it-admin@workspace.test",
        directoryCustomerId: "C0workspace",
        scopeType: DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS,
        scopeExternalIds: [],
        defaultRoleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
        archiveUsersOutsideScope: true,
        sendWelcomeEmail: false,
        archiveLimitPercentage: null,
      };
    },
  );

type UserExternalIdentity = typeof userExternalIdentities.$inferSelect;

/** Links an existing user to a connection, as a previous sync would have. */
export const createUserExternalIdentityFactory = (db: DatabasePg) =>
  Factory.define<typeof userExternalIdentities.$inferInsert, object, UserExternalIdentity>(
    ({ onCreate }) => {
      onCreate(async (identity) => {
        const [inserted] = await db.insert(userExternalIdentities).values(identity).returning();

        return inserted;
      });

      return {
        userId: faker.string.uuid(),
        connectionId: faker.string.uuid(),
        provider: DIRECTORY_SYNC_PROVIDERS.GOOGLE_WORKSPACE,
        externalId: `google-user-${faker.string.alphanumeric(10)}`,
        archivedByDirectorySync: false,
        rolesOverridden: false,
      };
    },
  );

type DirectorySyncRoleMappingAttributes = Omit<
  typeof directorySyncRoleMappings.$inferInsert,
  "roleId"
> & { roleSlug: SystemRoleSlug };

/** Maps a Google group to a system role given by slug. */
export const createDirectorySyncRoleMappingFactory = (db: DatabasePg) =>
  Factory.define<DirectorySyncRoleMappingAttributes>(({ onCreate }) => {
    onCreate(async ({ roleSlug, ...roleMapping }) => {
      const tenantId = await ensureTenant(db, roleMapping.tenantId);
      const roleId = await findPermissionRoleIdInTests(db, tenantId, roleSlug);

      await db.insert(directorySyncRoleMappings).values({ ...roleMapping, tenantId, roleId });

      return { ...roleMapping, roleSlug };
    });

    return {
      connectionId: faker.string.uuid(),
      externalGroupId: `google-group-${faker.string.alphanumeric(10)}`,
      externalGroupEmail: faker.internet.email(),
      roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
      priority: 0,
    };
  });

/** Maps a Google group to a Mentingo group whose membership the sync manages. */
export const createDirectorySyncGroupMappingFactory = (db: DatabasePg) =>
  Factory.define<typeof directorySyncGroupMappings.$inferInsert>(({ onCreate }) => {
    onCreate(async (groupMapping) => {
      const [inserted] = await db
        .insert(directorySyncGroupMappings)
        .values(groupMapping)
        .returning();

      return inserted;
    });

    return {
      connectionId: faker.string.uuid(),
      externalGroupId: `google-group-${faker.string.alphanumeric(10)}`,
      externalGroupEmail: faker.internet.email(),
      groupId: faker.string.uuid(),
    };
  });

type DirectorySyncRun = typeof directorySyncRuns.$inferSelect;

/** A queued run, ready to be synchronized directly without the queue. */
export const createDirectorySyncRunFactory = (db: DatabasePg) =>
  Factory.define<typeof directorySyncRuns.$inferInsert, object, DirectorySyncRun>(
    ({ onCreate }) => {
      onCreate(async (run) => {
        const [inserted] = await db.insert(directorySyncRuns).values(run).returning();

        return inserted;
      });

      return {
        connectionId: faker.string.uuid(),
        trigger: DIRECTORY_SYNC_RUN_TRIGGERS.MANUAL,
        triggeredByUserId: null,
        status: DIRECTORY_SYNC_RUN_STATUSES.QUEUED,
      };
    },
  );
