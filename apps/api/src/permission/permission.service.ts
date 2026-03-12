import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB_ADMIN } from "src/storage/db/db.providers";
import {
  permissionRoleRuleSets,
  permissionRoles,
  permissionRuleSetPermissions,
  permissionRuleSets,
  permissionUserRoles,
  users,
} from "src/storage/schema";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "./permission.constants";

import type { PermissionKey } from "./permission.constants";
import type { AssignedRole, HydratedPermissionContext } from "./permission.types";

@Injectable()
export class PermissionService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async getPermissionContext(
    userId: UUIDType,
    tenantId: UUIDType,
    options?: { isSupportMode?: boolean },
  ): Promise<HydratedPermissionContext> {
    const roles = await this.getUserRoles(userId, tenantId, options);

    const permissions = await this.getPermissionsForRoleIds(
      roles.map((role) => role.id),
      tenantId,
      options,
    );

    return {
      roles,
      permissions,
      role: this.getPrimarySystemRole(roles),
    };
  }

  async getUserRoles(
    userId: UUIDType,
    tenantId: UUIDType,
    options?: { isSupportMode?: boolean },
  ): Promise<AssignedRole[]> {
    if (options?.isSupportMode) {
      const [adminRole] = await this.dbAdmin
        .select({
          id: permissionRoles.id,
          slug: permissionRoles.slug,
          name: permissionRoles.name,
        })
        .from(permissionRoles)
        .where(
          and(
            eq(permissionRoles.tenantId, tenantId),
            eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.ADMIN),
          ),
        )
        .limit(1);

      if (!adminRole) {
        throw new UnauthorizedException("permission.error.adminRoleMissing");
      }

      return [adminRole];
    }

    return this.dbAdmin
      .select({
        id: permissionRoles.id,
        slug: permissionRoles.slug,
        name: permissionRoles.name,
      })
      .from(permissionUserRoles)
      .innerJoin(permissionRoles, eq(permissionUserRoles.roleId, permissionRoles.id))
      .innerJoin(users, eq(permissionUserRoles.userId, users.id))
      .where(
        and(
          eq(permissionUserRoles.userId, userId),
          eq(permissionUserRoles.tenantId, tenantId),
          eq(permissionRoles.tenantId, tenantId),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(permissionRoles.name));
  }

  async getPermissionsForRoleIds(
    roleIds: UUIDType[],
    tenantId: UUIDType,
    _options?: { isSupportMode?: boolean },
  ): Promise<PermissionKey[]> {
    if (!roleIds.length) {
      return [];
    }

    const rows = await this.dbAdmin
      .select({ permission: permissionRuleSetPermissions.permission })
      .from(permissionRoleRuleSets)
      .innerJoin(
        permissionRuleSetPermissions,
        eq(permissionRoleRuleSets.ruleSetId, permissionRuleSetPermissions.ruleSetId),
      )
      .where(
        and(
          inArray(permissionRoleRuleSets.roleId, roleIds),
          eq(permissionRoleRuleSets.tenantId, tenantId),
          eq(permissionRuleSetPermissions.tenantId, tenantId),
        ),
      );

    return [...new Set(rows.map((row) => row.permission as PermissionKey))];
  }

  async getRolesForUsers(
    userIds: UUIDType[],
    tenantId: UUIDType,
  ): Promise<Record<string, AssignedRole[]>> {
    if (!userIds.length) {
      return {};
    }

    const rows = await this.dbAdmin
      .select({
        userId: permissionUserRoles.userId,
        id: permissionRoles.id,
        slug: permissionRoles.slug,
        name: permissionRoles.name,
      })
      .from(permissionUserRoles)
      .innerJoin(permissionRoles, eq(permissionUserRoles.roleId, permissionRoles.id))
      .where(
        and(
          inArray(permissionUserRoles.userId, userIds),
          eq(permissionUserRoles.tenantId, tenantId),
          eq(permissionRoles.tenantId, tenantId),
        ),
      )
      .orderBy(asc(permissionRoles.name));

    return rows.reduce<Record<string, AssignedRole[]>>((acc, row) => {
      acc[row.userId] ??= [];
      acc[row.userId].push({
        id: row.id,
        slug: row.slug,
        name: row.name,
      });
      return acc;
    }, {});
  }

  getPrimarySystemRole(roles: AssignedRole[]): UserRole {
    const roleSlugs = new Set(roles.map((role) => role.slug));

    if (roleSlugs.has(USER_ROLES.ADMIN)) return USER_ROLES.ADMIN;
    if (roleSlugs.has(USER_ROLES.CONTENT_CREATOR)) return USER_ROLES.CONTENT_CREATOR;
    if (roleSlugs.has(USER_ROLES.STUDENT)) return USER_ROLES.STUDENT;

    return USER_ROLES.STUDENT;
  }

  async replaceUserSystemRoles(
    userId: UUIDType,
    tenantId: UUIDType,
    roleSlugs: UserRole[],
    dbInstance: DatabasePg = this.db,
  ) {
    const roleMap = await this.ensureSystemRolesForTenant(tenantId, dbInstance);

    await dbInstance.delete(permissionUserRoles).where(eq(permissionUserRoles.userId, userId));

    if (!roleSlugs.length) return;

    await dbInstance.insert(permissionUserRoles).values(
      roleSlugs.map((roleSlug) => ({
        userId,
        roleId: roleMap[roleSlug],
        tenantId,
      })),
    );
  }

  async ensureSystemRolesForTenant(
    tenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<Record<UserRole, UUIDType>> {
    for (const roleSlug of Object.values(USER_ROLES)) {
      const ruleSetSlug = `${roleSlug}-default`;

      await dbInstance
        .insert(permissionRoles)
        .values({
          name: this.getRoleDisplayName(roleSlug),
          slug: roleSlug,
          description: `${this.getRoleDisplayName(roleSlug)} system role`,
          isSystem: true,
          tenantId,
        })
        .onConflictDoNothing();

      await dbInstance
        .insert(permissionRuleSets)
        .values({
          name: `${this.getRoleDisplayName(roleSlug)} Default`,
          slug: ruleSetSlug,
          description: `${this.getRoleDisplayName(roleSlug)} default permissions`,
          isSystem: true,
          tenantId,
        })
        .onConflictDoNothing();
    }

    const roles = await dbInstance
      .select({
        id: permissionRoles.id,
        slug: permissionRoles.slug,
      })
      .from(permissionRoles)
      .where(
        and(
          eq(permissionRoles.tenantId, tenantId),
          inArray(permissionRoles.slug, Object.values(USER_ROLES)),
        ),
      );

    const ruleSets = await dbInstance
      .select({
        id: permissionRuleSets.id,
        slug: permissionRuleSets.slug,
      })
      .from(permissionRuleSets)
      .where(
        and(
          eq(permissionRuleSets.tenantId, tenantId),
          inArray(
            permissionRuleSets.slug,
            Object.values(USER_ROLES).map((roleSlug) => `${roleSlug}-default`),
          ),
        ),
      );

    const roleMap = roles.reduce<Record<string, UUIDType>>((acc, role) => {
      acc[role.slug] = role.id;
      return acc;
    }, {});

    const ruleSetMap = ruleSets.reduce<Record<string, UUIDType>>((acc, ruleSet) => {
      acc[ruleSet.slug] = ruleSet.id;
      return acc;
    }, {});

    for (const roleSlug of Object.values(USER_ROLES)) {
      const roleId = roleMap[roleSlug];
      const ruleSetId = ruleSetMap[`${roleSlug}-default`];

      if (!roleId || !ruleSetId) continue;

      await dbInstance
        .insert(permissionRoleRuleSets)
        .values({
          roleId,
          ruleSetId,
          tenantId,
        })
        .onConflictDoNothing();

      const permissions = SYSTEM_ROLE_PERMISSIONS[roleSlug] ?? [];
      if (!permissions.length) continue;

      await dbInstance
        .insert(permissionRuleSetPermissions)
        .values(
          permissions.map((permission) => ({
            ruleSetId,
            permission,
            tenantId,
          })),
        )
        .onConflictDoNothing();
    }

    return roleMap as Record<UserRole, UUIDType>;
  }

  private getRoleDisplayName(roleSlug: UserRole): string {
    switch (roleSlug) {
      case USER_ROLES.ADMIN:
        return "Admin";
      case USER_ROLES.CONTENT_CREATOR:
        return "Content Creator";
      case USER_ROLES.STUDENT:
      default:
        return "Student";
    }
  }
}
