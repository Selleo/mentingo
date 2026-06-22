import { Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES, type PermissionKey } from "@repo/shared";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import {
  createTokens,
  groups,
  permissionRoles,
  permissionRoleRuleSets,
  permissionRuleSetPermissions,
  permissionUserRoles,
  userDetails,
  userOnboarding,
  users,
} from "src/storage/schema";

import type {
  CreateUsersCoreBulkCreateTokenInsert,
  CreateUsersCoreBulkRoleAssignmentInsert,
  CreateUsersCoreBulkUserData,
  CreateUsersCoreBulkUserDetailsInsert,
  UserImportValidationData,
  UserImportValidationLookupData,
} from "src/user/user.types";

@Injectable()
export class UserImportRepository {
  constructor(
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findExistingUsersByEmails(emails: string[]) {
    if (!emails.length) return [];

    return this.dbAdmin
      .select({ email: users.email })
      .from(users)
      .where(inArray(users.email, emails));
  }

  async findImportValidationData(
    data: UserImportValidationLookupData,
    dbInstance: DatabasePg,
  ): Promise<UserImportValidationData> {
    const { roleSlugs, groupNames } = data;

    const localizedGroupName = this.localizationService.getLocalizedSqlField(
      groups.name,
      SUPPORTED_LANGUAGES.EN,
      groups,
    );

    const resolvedRoles = dbInstance.$with("resolved_import_roles").as(
      dbInstance
        .select({
          id: permissionRoles.id,
          slug: permissionRoles.slug,
        })
        .from(permissionRoles)
        .where(
          roleSlugs.length
            ? inArray(sql<string>`lower(${permissionRoles.slug})`, roleSlugs)
            : sql`false`,
        ),
    );

    const resolvedGroups = dbInstance.$with("resolved_import_groups").as(
      dbInstance
        .select({
          id: groups.id,
          normalizedName: sql<string>`lower(${localizedGroupName})`.as("normalized_name"),
        })
        .from(groups)
        .where(
          groupNames.length
            ? inArray(sql<string>`lower(${localizedGroupName})`, groupNames)
            : sql`false`,
        ),
    );

    const [validationData] = await dbInstance
      .with(resolvedRoles, resolvedGroups)
      .select({
        roles: sql<UserImportValidationData["roles"]>`COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', ${resolvedRoles.id},
                'slug', ${resolvedRoles.slug}
              )
            )
            FROM ${resolvedRoles}
          ),
          '[]'::jsonb
        )`,
        groups: sql<UserImportValidationData["groups"]>`COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', ${resolvedGroups.id},
                'normalizedName', ${resolvedGroups.normalizedName}
              )
            )
            FROM ${resolvedGroups}
          ),
          '[]'::jsonb
        )`,
      })
      .from(sql`(SELECT 1) AS import_validation_seed`);

    return validationData ?? { roles: [], groups: [] };
  }

  async insertUsers(userInsertRows: CreateUsersCoreBulkUserData[], dbInstance: DatabasePg) {
    return dbInstance.insert(users).values(userInsertRows).returning();
  }

  async insertUserOnboardingRows(userIds: UUIDType[], dbInstance: DatabasePg) {
    if (!userIds.length) return;

    await dbInstance.insert(userOnboarding).values(userIds.map((userId) => ({ userId })));
  }

  async findRoleSlugsWithAnyPermission(
    roleSlugs: string[],
    permissions: PermissionKey[],
    dbInstance: DatabasePg,
  ) {
    if (!roleSlugs.length || !permissions.length) return [];

    return dbInstance
      .selectDistinct({ roleSlug: permissionRoles.slug })
      .from(permissionRoles)
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
          inArray(permissionRoles.slug, roleSlugs),
          inArray(permissionRuleSetPermissions.permission, permissions),
        ),
      );
  }

  async insertUserRoleAssignments(
    roleAssignments: CreateUsersCoreBulkRoleAssignmentInsert[],
    dbInstance: DatabasePg,
  ) {
    if (!roleAssignments.length) return;

    await dbInstance.insert(permissionUserRoles).values(roleAssignments);
  }

  async insertCreateTokens(
    createTokenRows: CreateUsersCoreBulkCreateTokenInsert[],
    dbInstance: DatabasePg,
  ) {
    if (!createTokenRows.length) return;

    await dbInstance.insert(createTokens).values(
      createTokenRows.map(({ userId, tokenHash, expiryDate, reminderCount }) => ({
        userId,
        tokenHash,
        expiryDate,
        reminderCount,
      })),
    );
  }

  async insertUserDetails(
    userDetailsRows: CreateUsersCoreBulkUserDetailsInsert[],
    dbInstance: DatabasePg,
  ) {
    if (!userDetailsRows.length) return;

    await dbInstance.insert(userDetails).values(userDetailsRows);
  }
}
