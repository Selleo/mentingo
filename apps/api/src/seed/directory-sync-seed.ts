import {
  DIRECTORY_SYNC_CONNECTION_STATUSES,
  DIRECTORY_SYNC_PROVIDERS,
  DIRECTORY_SYNC_SCOPE_TYPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@repo/shared";
import * as dotenv from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { FAKE_DIRECTORY_FIXTURE_ENV } from "../directory-sync/directory-sync.constants";
import { readFakeDirectoryWorkspace } from "../directory-sync/providers/fake-directory/read-fake-directory-workspace";
import {
  directorySyncConnections,
  directorySyncGroupMappings,
  directorySyncRoleMappings,
  groups,
  permissionRoles,
  tenants,
  users,
} from "../storage/schema";

import {
  DIRECTORY_SYNC_SEED_CREATOR_EMAIL,
  DIRECTORY_SYNC_SEED_GROUP_MAPPING_EXTERNAL_IDS,
  DIRECTORY_SYNC_SEED_ROLE_MAPPINGS,
} from "./directory-sync-seed-data";
import { addEmailSuffix, getSeedTenantOrigins, getTenantEmailSuffix } from "./seed-helpers";

import type { DatabasePg, UUIDType } from "../common";
import type { FakeDirectoryWorkspace } from "../directory-sync/providers/fake-directory/fake-directory.schema";

dotenv.config({ path: "./.env" });

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const fixturePath = process.env[FAKE_DIRECTORY_FIXTURE_ENV];

if (!fixturePath) {
  throw new Error(`${FAKE_DIRECTORY_FIXTURE_ENV} not found on .env`);
}

const sqlConnect = postgres(connectionString);
const seedDb = drizzle(sqlConnect) as DatabasePg;

/**
 * Connects every seeded tenant to the fake directory named by DIRECTORY_SYNC_FAKE_DIRECTORY, with
 * role and group mappings for the example workspace. The first sync stays manual: click Sync now.
 * A tenant that already has a connection is skipped.
 */
async function seedDirectorySync() {
  const workspace = readFakeDirectoryWorkspace(String(fixturePath));

  try {
    for (const origin of getSeedTenantOrigins()) {
      await seedTenant(origin, workspace);
    }
  } finally {
    await sqlConnect.end();
  }
}

async function seedTenant(origin: string, workspace: FakeDirectoryWorkspace) {
  const [tenant] = await seedDb.select().from(tenants).where(eq(tenants.host, origin));
  if (!tenant) {
    console.log(`⏭️  ${origin}: tenant not found, run pnpm db:seed first`);
    return;
  }

  await seedDb.transaction((trx) => seedTenantConnection(trx, origin, tenant.id, workspace));
}

async function seedTenantConnection(
  db: DatabasePg,
  origin: string,
  tenantId: UUIDType,
  workspace: FakeDirectoryWorkspace,
) {
  const [existingConnection] = await db
    .select({ id: directorySyncConnections.id })
    .from(directorySyncConnections)
    .where(eq(directorySyncConnections.tenantId, tenantId));
  if (existingConnection) {
    console.log(`⏭️  ${origin}: directory sync already connected`);
    return;
  }

  const administrator = workspace.users.find((user) => user.isAdmin);
  if (!administrator) {
    throw new Error("The fake directory needs a user with isAdmin set to connect");
  }

  const creatorEmail = addEmailSuffix(
    DIRECTORY_SYNC_SEED_CREATOR_EMAIL,
    getTenantEmailSuffix(origin),
  );
  const [creator] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, creatorEmail)));

  const [connection] = await db
    .insert(directorySyncConnections)
    .values({
      tenantId,
      provider: DIRECTORY_SYNC_PROVIDERS.GOOGLE_WORKSPACE,
      status: DIRECTORY_SYNC_CONNECTION_STATUSES.ACTIVE,
      administratorEmail: administrator.email,
      directoryCustomerId: workspace.customerId,
      scopeType: DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS,
      scopeExternalIds: [],
      defaultRoleId: await findRoleId(db, tenantId, SYSTEM_ROLE_SLUGS.STUDENT),
      createdByUserId: creator?.id ?? null,
    })
    .returning({ id: directorySyncConnections.id });

  const findWorkspaceGroup = (externalGroupId: string) =>
    workspace.groups.find((group) => group.id === externalGroupId);

  for (const [priority, roleMapping] of DIRECTORY_SYNC_SEED_ROLE_MAPPINGS.entries()) {
    const workspaceGroup = findWorkspaceGroup(roleMapping.externalGroupId);
    if (!workspaceGroup) continue;

    await db.insert(directorySyncRoleMappings).values({
      tenantId,
      connectionId: connection.id,
      externalGroupId: workspaceGroup.id,
      externalGroupEmail: workspaceGroup.email,
      roleId: await findRoleId(db, tenantId, roleMapping.roleSlug),
      priority,
    });
  }

  for (const externalGroupId of DIRECTORY_SYNC_SEED_GROUP_MAPPING_EXTERNAL_IDS) {
    const workspaceGroup = findWorkspaceGroup(externalGroupId);
    if (!workspaceGroup) continue;

    const [group] = await db
      .insert(groups)
      .values({ tenantId, name: { [SUPPORTED_LANGUAGES.EN]: workspaceGroup.name } })
      .returning({ id: groups.id });

    await db.insert(directorySyncGroupMappings).values({
      tenantId,
      connectionId: connection.id,
      externalGroupId: workspaceGroup.id,
      externalGroupEmail: workspaceGroup.email,
      groupId: group.id,
    });
  }

  console.log(`✅ ${origin}: connected to the fake directory as ${administrator.email}`);
}

async function findRoleId(db: DatabasePg, tenantId: UUIDType, roleSlug: SystemRoleSlug) {
  const [role] = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(and(eq(permissionRoles.tenantId, tenantId), eq(permissionRoles.slug, roleSlug)));

  if (!role) throw new Error(`System role ${roleSlug} not found, run pnpm db:seed first`);

  return role.id;
}

if (require.main === module) {
  seedDirectorySync()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Directory sync seeding failed:", error);
      process.exit(1);
    });
}

export default seedDirectorySync;
