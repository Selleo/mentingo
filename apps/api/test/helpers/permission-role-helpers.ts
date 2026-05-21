import {
  PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  SYSTEM_RULE_SET_SLUGS,
  type PermissionKey,
  type SystemRoleSlug,
} from "@repo/shared";
import { and, eq, sql, type SQL } from "drizzle-orm";

import {
  permissionRoles,
  permissionRoleRuleSets,
  permissionRuleSetPermissions,
  permissionRuleSets,
  permissionUserRoles,
} from "src/storage/schema";

import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { DatabasePg, UUIDType } from "src/common";

const SYSTEM_ROLE_DISPLAY_NAME: Record<SystemRoleSlug, string> = {
  [SYSTEM_ROLE_SLUGS.ADMIN]: "Admin",
  [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: "Content Creator",
  [SYSTEM_ROLE_SLUGS.TRAINER]: "Trainer",
  [SYSTEM_ROLE_SLUGS.STUDENT]: "Student",
};

export async function ensureSystemRolesForTenantInTests(db: DatabasePg, tenantId: UUIDType) {
  for (const roleSlug of Object.values(SYSTEM_ROLE_SLUGS)) {
    const ruleSetSlug = SYSTEM_RULE_SET_SLUGS[roleSlug];
    const permissions = SYSTEM_ROLE_PERMISSIONS[roleSlug];

    const [role] = await db
      .insert(permissionRoles)
      .values({
        tenantId,
        name: SYSTEM_ROLE_DISPLAY_NAME[roleSlug],
        slug: roleSlug,
        isSystem: true,
      })
      .onConflictDoNothing({
        target: [permissionRoles.tenantId, permissionRoles.slug],
      })
      .returning({ id: permissionRoles.id });
    const roleId = role?.id ?? (await findPermissionRoleIdInTests(db, tenantId, roleSlug));

    const [ruleSet] = await db
      .insert(permissionRuleSets)
      .values({
        tenantId,
        name: SYSTEM_ROLE_DISPLAY_NAME[roleSlug],
        slug: ruleSetSlug,
        isSystem: true,
      })
      .onConflictDoNothing({
        target: [permissionRuleSets.tenantId, permissionRuleSets.slug],
      })
      .returning({ id: permissionRuleSets.id });
    const ruleSetId =
      ruleSet?.id ?? (await findPermissionRuleSetIdInTests(db, tenantId, ruleSetSlug));

    await db
      .insert(permissionRoleRuleSets)
      .values({
        tenantId,
        roleId,
        ruleSetId,
      })
      .onConflictDoNothing({
        target: [permissionRoleRuleSets.roleId, permissionRoleRuleSets.ruleSetId],
      });

    await db
      .delete(permissionRuleSetPermissions)
      .where(
        and(
          eq(permissionRuleSetPermissions.ruleSetId, ruleSetId),
          eq(permissionRuleSetPermissions.tenantId, tenantId),
        ),
      );

    if (permissions.length) {
      await db
        .insert(permissionRuleSetPermissions)
        .values(
          permissions.map((permission) => ({
            tenantId,
            ruleSetId,
            permission,
          })),
        )
        .onConflictDoNothing({
          target: [permissionRuleSetPermissions.ruleSetId, permissionRuleSetPermissions.permission],
        });
    }
  }
}

export async function assignSystemRoleToUserInTests(
  db: DatabasePg,
  userId: UUIDType,
  tenantId: UUIDType,
  roleSlug: SystemRoleSlug,
) {
  await ensureSystemRolesForTenantInTests(db, tenantId);

  const [role] = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(and(eq(permissionRoles.tenantId, tenantId), eq(permissionRoles.slug, roleSlug)))
    .limit(1);

  if (!role) {
    throw new Error(`System role '${roleSlug}' not found for tenant ${tenantId}`);
  }

  await db.delete(permissionUserRoles).where(eq(permissionUserRoles.userId, userId));

  await db.insert(permissionUserRoles).values({
    userId,
    roleId: role.id,
    tenantId,
  });
}

async function findPermissionRoleIdInTests(
  db: DatabasePg,
  tenantId: UUIDType,
  roleSlug: SystemRoleSlug,
) {
  const [role] = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(and(eq(permissionRoles.tenantId, tenantId), eq(permissionRoles.slug, roleSlug)))
    .limit(1);

  if (!role) throw new Error(`System role ${roleSlug} was not inserted or found`);

  return role.id;
}

async function findPermissionRuleSetIdInTests(
  db: DatabasePg,
  tenantId: UUIDType,
  ruleSetSlug: string,
) {
  const [ruleSet] = await db
    .select({ id: permissionRuleSets.id })
    .from(permissionRuleSets)
    .where(and(eq(permissionRuleSets.tenantId, tenantId), eq(permissionRuleSets.slug, ruleSetSlug)))
    .limit(1);

  if (!ruleSet) throw new Error(`System rule set ${ruleSetSlug} was not inserted or found`);

  return ruleSet.id;
}

export function userLacksPermissionCondition(
  userIdColumn: AnyPgColumn,
  tenantIdColumn: AnyPgColumn,
  permission: PermissionKey = PERMISSIONS.TENANT_MANAGE,
): SQL {
  return sql`
    NOT EXISTS (
      SELECT 1
      FROM ${permissionUserRoles}
      INNER JOIN ${permissionRoleRuleSets}
        ON ${permissionRoleRuleSets.roleId} = ${permissionUserRoles.roleId}
       AND ${permissionRoleRuleSets.tenantId} = ${permissionUserRoles.tenantId}
      INNER JOIN ${permissionRuleSetPermissions}
        ON ${permissionRuleSetPermissions.ruleSetId} = ${permissionRoleRuleSets.ruleSetId}
       AND ${permissionRuleSetPermissions.tenantId} = ${permissionRoleRuleSets.tenantId}
      WHERE ${permissionUserRoles.userId} = ${userIdColumn}
        AND ${permissionUserRoles.tenantId} = ${tenantIdColumn}
        AND ${permissionRuleSetPermissions.permission} = ${permission}
    )
  `;
}
