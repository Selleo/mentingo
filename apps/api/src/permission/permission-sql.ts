import { sql } from "drizzle-orm";

import {
  permissionRoleRuleSets,
  permissionRoles,
  permissionRuleSetPermissions,
  permissionUserRoles,
} from "src/storage/schema";

import type { PermissionKey, SystemRoleSlug } from "./permission.constants";
import type { SQL } from "drizzle-orm";

const buildInClause = (roleSlugs: SystemRoleSlug[]) =>
  sql.join(roleSlugs.map((slug) => sql`${slug}`), sql`, `);

export const hasSystemRoleCondition = (
  userIdExpr: SQL,
  tenantIdExpr: SQL,
  roleSlug: SystemRoleSlug,
): SQL =>
  sql`EXISTS (
    SELECT 1
    FROM ${permissionUserRoles}
    INNER JOIN ${permissionRoles} ON ${permissionUserRoles.roleId} = ${permissionRoles.id}
    WHERE ${permissionUserRoles.userId} = ${userIdExpr}
      AND ${permissionUserRoles.tenantId} = ${tenantIdExpr}
      AND ${permissionRoles.tenantId} = ${tenantIdExpr}
      AND ${permissionRoles.slug} = ${roleSlug}
  )`;

export const hasAnySystemRoleCondition = (
  userIdExpr: SQL,
  tenantIdExpr: SQL,
  roleSlugs: SystemRoleSlug[],
): SQL => {
  if (!roleSlugs.length) {
    return sql`FALSE`;
  }

  return sql`EXISTS (
    SELECT 1
    FROM ${permissionUserRoles}
    INNER JOIN ${permissionRoles} ON ${permissionUserRoles.roleId} = ${permissionRoles.id}
    WHERE ${permissionUserRoles.userId} = ${userIdExpr}
      AND ${permissionUserRoles.tenantId} = ${tenantIdExpr}
      AND ${permissionRoles.tenantId} = ${tenantIdExpr}
      AND ${permissionRoles.slug} IN (${buildInClause(roleSlugs)})
  )`;
};

const buildPermissionInClause = (permissions: PermissionKey[]) =>
  sql.join(permissions.map((permission) => sql`${permission}`), sql`, `);

export const hasPermissionCondition = (
  userIdExpr: SQL,
  tenantIdExpr: SQL,
  permission: PermissionKey,
): SQL =>
  sql`EXISTS (
    SELECT 1
    FROM ${permissionUserRoles}
    INNER JOIN ${permissionRoleRuleSets} ON ${permissionRoleRuleSets.roleId} = ${permissionUserRoles.roleId}
    INNER JOIN ${permissionRuleSetPermissions} ON ${permissionRuleSetPermissions.ruleSetId} = ${permissionRoleRuleSets.ruleSetId}
    WHERE ${permissionUserRoles.userId} = ${userIdExpr}
      AND ${permissionUserRoles.tenantId} = ${tenantIdExpr}
      AND ${permissionRoleRuleSets.tenantId} = ${tenantIdExpr}
      AND ${permissionRuleSetPermissions.tenantId} = ${tenantIdExpr}
      AND ${permissionRuleSetPermissions.permission} = ${permission}
  )`;

export const hasAnyPermissionCondition = (
  userIdExpr: SQL,
  tenantIdExpr: SQL,
  permissions: PermissionKey[],
): SQL => {
  if (!permissions.length) {
    return sql`FALSE`;
  }

  return sql`EXISTS (
    SELECT 1
    FROM ${permissionUserRoles}
    INNER JOIN ${permissionRoleRuleSets} ON ${permissionRoleRuleSets.roleId} = ${permissionUserRoles.roleId}
    INNER JOIN ${permissionRuleSetPermissions} ON ${permissionRuleSetPermissions.ruleSetId} = ${permissionRoleRuleSets.ruleSetId}
    WHERE ${permissionUserRoles.userId} = ${userIdExpr}
      AND ${permissionUserRoles.tenantId} = ${tenantIdExpr}
      AND ${permissionRoleRuleSets.tenantId} = ${tenantIdExpr}
      AND ${permissionRuleSetPermissions.tenantId} = ${tenantIdExpr}
      AND ${permissionRuleSetPermissions.permission} IN (${buildPermissionInClause(permissions)})
  )`;
};
