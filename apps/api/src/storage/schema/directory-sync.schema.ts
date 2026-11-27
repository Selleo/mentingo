import {
  DIRECTORY_SYNC_CONNECTION_STATUSES,
  DIRECTORY_SYNC_RUN_STATUSES,
  DIRECTORY_SYNC_SCOPE_TYPES,
  type DirectorySyncConnectionStatus,
  type DirectorySyncProvider,
  type DirectorySyncRunStatus,
  type DirectorySyncRunTrigger,
  type DirectorySyncScopeType,
} from "@repo/shared";
import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { id, tenantId, timestamps, timestampWithTimezone, withTenantIdIndex } from "./utils";

import { groups, permissionRoles, users } from ".";

export const directorySyncConnections = pgTable(
  "directory_sync_connections",
  {
    ...id,
    ...timestamps,
    provider: text("provider").$type<DirectorySyncProvider>().notNull(),
    status: text("status")
      .$type<DirectorySyncConnectionStatus>()
      .notNull()
      .default(DIRECTORY_SYNC_CONNECTION_STATUSES.PENDING_VERIFICATION),
    administratorEmail: text("administrator_email").notNull(),
    directoryCustomerId: text("directory_customer_id"),
    scopeType: text("scope_type")
      .$type<DirectorySyncScopeType>()
      .notNull()
      .default(DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS),
    scopeExternalIds: text("scope_external_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    defaultRoleId: uuid("default_role_id")
      .references(() => permissionRoles.id, { onDelete: "restrict" })
      .notNull(),
    archiveUsersOutsideScope: boolean("archive_users_outside_scope").notNull().default(true),
    archiveLimitPercentage: integer("archive_limit_percentage"),
    sendWelcomeEmail: boolean("send_welcome_email").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastSuccessfulSyncAt: timestampWithTimezone({ name: "last_successful_sync_at" }),
    missingExternalIds: text("missing_external_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    tenantId,
  },
  withTenantIdIndex("directory_sync_connections", (table) => ({
    tenantProviderUniqueIdx: uniqueIndex(
      "directory_sync_connections_tenant_provider_unique_idx",
    ).on(table.tenantId, table.provider),
  })),
);

export const directorySyncRoleMappings = pgTable(
  "directory_sync_role_mappings",
  {
    ...id,
    ...timestamps,
    connectionId: uuid("connection_id")
      .references(() => directorySyncConnections.id, { onDelete: "cascade" })
      .notNull(),
    externalGroupId: text("external_group_id").notNull(),
    externalGroupEmail: text("external_group_email").notNull(),
    roleId: uuid("role_id")
      .references(() => permissionRoles.id, { onDelete: "cascade" })
      .notNull(),
    priority: integer("priority").notNull(),
    tenantId,
  },
  withTenantIdIndex("directory_sync_role_mappings", (table) => ({
    connectionGroupUniqueIdx: uniqueIndex(
      "directory_sync_role_mappings_connection_group_unique_idx",
    ).on(table.connectionId, table.externalGroupId),
    connectionPriorityUniqueIdx: uniqueIndex(
      "directory_sync_role_mappings_connection_priority_unique_idx",
    ).on(table.connectionId, table.priority),
  })),
);

export const directorySyncGroupMappings = pgTable(
  "directory_sync_group_mappings",
  {
    ...id,
    ...timestamps,
    connectionId: uuid("connection_id")
      .references(() => directorySyncConnections.id, { onDelete: "cascade" })
      .notNull(),
    externalGroupId: text("external_group_id").notNull(),
    externalGroupEmail: text("external_group_email").notNull(),
    groupId: uuid("group_id")
      .references(() => groups.id, { onDelete: "cascade" })
      .notNull(),
    tenantId,
  },
  withTenantIdIndex("directory_sync_group_mappings", (table) => ({
    connectionExternalGroupUniqueIdx: uniqueIndex(
      "directory_sync_group_mappings_connection_external_group_unique_idx",
    ).on(table.connectionId, table.externalGroupId),
    connectionGroupUniqueIdx: uniqueIndex(
      "directory_sync_group_mappings_connection_group_unique_idx",
    ).on(table.connectionId, table.groupId),
  })),
);

export const userExternalIdentities = pgTable(
  "user_external_identities",
  {
    ...id,
    ...timestamps,
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    connectionId: uuid("connection_id")
      .references(() => directorySyncConnections.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").$type<DirectorySyncProvider>().notNull(),
    externalId: text("external_id").notNull(),
    archivedByDirectorySync: boolean("archived_by_directory_sync").notNull().default(false),
    rolesOverridden: boolean("roles_overridden").notNull().default(false),
    tenantId,
  },
  withTenantIdIndex("user_external_identities", (table) => ({
    providerExternalIdUniqueIdx: uniqueIndex(
      "user_external_identities_tenant_provider_external_id_unique_idx",
    ).on(table.tenantId, table.provider, table.externalId),
    userProviderUniqueIdx: uniqueIndex(
      "user_external_identities_tenant_user_provider_unique_idx",
    ).on(table.tenantId, table.userId, table.provider),
    connectionIdx: index("user_external_identities_connection_idx").on(table.connectionId),
  })),
);

export const directorySyncRuns = pgTable(
  "directory_sync_runs",
  {
    ...id,
    ...timestamps,
    connectionId: uuid("connection_id")
      .references(() => directorySyncConnections.id, { onDelete: "cascade" })
      .notNull(),
    trigger: text("trigger").$type<DirectorySyncRunTrigger>().notNull(),
    triggeredByUserId: uuid("triggered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status")
      .$type<DirectorySyncRunStatus>()
      .notNull()
      .default(DIRECTORY_SYNC_RUN_STATUSES.QUEUED),
    startedAt: timestampWithTimezone({ name: "started_at" }),
    finishedAt: timestampWithTimezone({ name: "finished_at" }),
    createdUsersCount: integer("created_users_count").notNull().default(0),
    linkedUsersCount: integer("linked_users_count").notNull().default(0),
    roleChangedUsersCount: integer("role_changed_users_count").notNull().default(0),
    archivedUsersCount: integer("archived_users_count").notNull().default(0),
    restoredUsersCount: integer("restored_users_count").notNull().default(0),
    groupMembershipChangedUsersCount: integer("group_membership_changed_users_count")
      .notNull()
      .default(0),
    skippedUsersCount: integer("skipped_users_count").notNull().default(0),
    tenantId,
  },
  withTenantIdIndex("directory_sync_runs", (table) => ({
    connectionCreatedAtIdx: index("directory_sync_runs_connection_created_at_idx").on(
      table.connectionId,
      table.createdAt,
    ),
    connectionUnfinishedRunUniqueIdx: uniqueIndex(
      "directory_sync_runs_connection_unfinished_unique_idx",
    )
      .on(table.connectionId)
      .where(
        sql`${table.status} IN ('${sql.raw(DIRECTORY_SYNC_RUN_STATUSES.QUEUED)}', '${sql.raw(DIRECTORY_SYNC_RUN_STATUSES.RUNNING)}')`,
      ),
  })),
);
