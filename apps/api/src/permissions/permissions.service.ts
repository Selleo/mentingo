import { Injectable, Inject } from "@nestjs/common";
import { and, eq, notExists } from "drizzle-orm";

import { DatabasePg } from "src/common";
import {
  permissionRoleRuleSets,
  permissionRoles,
  permissionRuleSetPermissions,
  permissionUserRoles,
  users,
} from "src/storage/schema";

import type { PermissionKey } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class PermissionsService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public excludeUsersWithPermission(permission: PermissionKey) {
    return notExists(
      this.db
        .select({ userId: permissionUserRoles.userId })
        .from(permissionUserRoles)
        .innerJoin(
          permissionRoles,
          and(
            eq(permissionRoles.id, permissionUserRoles.roleId),
            eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
          ),
        )
        .innerJoin(
          permissionRoleRuleSets,
          and(
            eq(permissionRoleRuleSets.roleId, permissionRoles.id),
            eq(permissionRoleRuleSets.tenantId, permissionRoles.tenantId),
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
            eq(permissionUserRoles.userId, users.id),
            eq(permissionRuleSetPermissions.permission, permission),
          ),
        ),
    );
  }

  public async getUserAccess(userId: UUIDType, dbInstance: DatabasePg = this.db) {
    const roleRows = await dbInstance
      .select({
        roleSlug: permissionRoles.slug,
      })
      .from(permissionUserRoles)
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(eq(permissionUserRoles.userId, userId));

    const permissionRows = await dbInstance
      .select({
        permission: permissionRuleSetPermissions.permission,
      })
      .from(permissionUserRoles)
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .innerJoin(
        permissionRoleRuleSets,
        and(
          eq(permissionRoleRuleSets.roleId, permissionRoles.id),
          eq(permissionRoleRuleSets.tenantId, permissionRoles.tenantId),
        ),
      )
      .innerJoin(
        permissionRuleSetPermissions,
        and(
          eq(permissionRuleSetPermissions.ruleSetId, permissionRoleRuleSets.ruleSetId),
          eq(permissionRuleSetPermissions.tenantId, permissionRoleRuleSets.tenantId),
        ),
      )
      .where(eq(permissionUserRoles.userId, userId));

    const roleSlugs = Array.from(new Set(roleRows.map((row) => row.roleSlug)));

    const permissions = Array.from(
      new Set(permissionRows.map((row) => row.permission as PermissionKey)),
    );

    return { roleSlugs, permissions };
  }
}
