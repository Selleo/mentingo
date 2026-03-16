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
      .onConflictDoUpdate({
        target: [permissionRoles.tenantId, permissionRoles.slug],
        set: {
          name: SYSTEM_ROLE_DISPLAY_NAME[roleSlug],
          isSystem: true,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({ id: permissionRoles.id });

    const [ruleSet] = await db
      .insert(permissionRuleSets)
      .values({
        tenantId,
        name: `${SYSTEM_ROLE_DISPLAY_NAME[roleSlug]} Default`,
        slug: ruleSetSlug,
        isSystem: true,
      })
      .onConflictDoUpdate({
        target: [permissionRuleSets.tenantId, permissionRuleSets.slug],
        set: {
          name: `${SYSTEM_ROLE_DISPLAY_NAME[roleSlug]} Default`,
          isSystem: true,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({ id: permissionRuleSets.id });

    await db
      .insert(permissionRoleRuleSets)
      .values({
        tenantId,
        roleId: role.id,
        ruleSetId: ruleSet.id,
      })
      .onConflictDoNothing({
        target: [permissionRoleRuleSets.roleId, permissionRoleRuleSets.ruleSetId],
      });

    await db
      .delete(permissionRuleSetPermissions)
      .where(
        and(
          eq(permissionRuleSetPermissions.ruleSetId, ruleSet.id),
          eq(permissionRuleSetPermissions.tenantId, tenantId),
        ),
      );

    if (permissions.length) {
      await db
        .insert(permissionRuleSetPermissions)
        .values(
          permissions.map((permission) => ({
            tenantId,
            ruleSetId: ruleSet.id,
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
