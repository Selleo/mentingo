import { and, eq, exists, not, or, sql } from "drizzle-orm";

import {
  permissionRoleRuleSets,
  permissionRuleSetPermissions,
  permissionUserRoles,
} from "src/storage/schema";

import type { PermissionKey } from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { DatabasePg } from "src/common";

export const userHasPermissionCondition = (
  db: DatabasePg,
  userIdColumn: AnyPgColumn,
  tenantIdColumn: AnyPgColumn,
  permission: PermissionKey,
): SQL => {
  return exists(
    db
      .select({ userId: permissionUserRoles.userId })
      .from(permissionUserRoles)
      .innerJoin(
        permissionRoleRuleSets,
        and(
          eq(permissionRoleRuleSets.roleId, permissionUserRoles.roleId),
          eq(permissionRoleRuleSets.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .innerJoin(
        permissionRuleSetPermissions,
        and(
          eq(permissionRuleSetPermissions.ruleSetId, permissionRoleRuleSets.ruleSetId),
          eq(permissionRuleSetPermissions.tenantId, permissionRoleRuleSets.tenantId),
        ),
      )
      .where(
        and(
          eq(permissionUserRoles.userId, userIdColumn),
          eq(permissionUserRoles.tenantId, tenantIdColumn),
          eq(permissionRuleSetPermissions.permission, permission),
        ),
      ),
  );
};

export const userHasAnyPermissionsCondition = (
  db: DatabasePg,
  userIdColumn: AnyPgColumn,
  tenantIdColumn: AnyPgColumn,
  permissions: PermissionKey[],
): SQL => {
  if (!permissions.length) return sql`FALSE`;

  return or(
    ...permissions.map((permission) =>
      userHasPermissionCondition(db, userIdColumn, tenantIdColumn, permission),
    ),
  ) as SQL;
};

export const userLacksPermissionCondition = (
  db: DatabasePg,
  userIdColumn: AnyPgColumn,
  tenantIdColumn: AnyPgColumn,
  permission: PermissionKey,
): SQL => {
  return not(userHasPermissionCondition(db, userIdColumn, tenantIdColumn, permission));
};

export const userLacksAnyPermissionsCondition = (
  db: DatabasePg,
  userIdColumn: AnyPgColumn,
  tenantIdColumn: AnyPgColumn,
  permissions: PermissionKey[],
): SQL => {
  if (!permissions.length) return sql`TRUE`;

  return and(
    ...permissions.map((permission) =>
      userLacksPermissionCondition(db, userIdColumn, tenantIdColumn, permission),
    ),
  ) as SQL;
};
