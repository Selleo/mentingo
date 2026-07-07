import { Inject, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS, SYSTEM_RULE_SET_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import {
  permissionRoleRuleSets,
  permissionRoles,
  permissionRuleSetPermissions,
  permissionRuleSets,
} from "src/storage/schema";

import type { SystemRoleSlug } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class PermissionsBackfillService {
  private readonly systemRoleDisplayName: Record<SystemRoleSlug, string> = {
    [SYSTEM_ROLE_SLUGS.ADMIN]: "Admin",
    [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: "Content Creator",
    [SYSTEM_ROLE_SLUGS.TRAINER]: "Trainer",
    [SYSTEM_ROLE_SLUGS.STUDENT]: "Student",
  };

  constructor(
    private readonly tenantDbRunner: TenantDbRunnerService,
    @Inject(DB) private readonly db: DatabasePg,
  ) {}

  async backfillMissingPermissionsForAllTenants() {
    let tenantCount = 0;
    let insertedCount = 0;

    await this.tenantDbRunner.runForEachTenant(async (tenantId) => {
      tenantCount += 1;
      insertedCount += await this.backfillMissingPermissionsForTenant(tenantId);
    });

    return { tenantCount, insertedCount };
  }

  private async backfillMissingPermissionsForTenant(tenantId: UUIDType) {
    let insertedCount = 0;

    for (const roleSlug of Object.values(SYSTEM_ROLE_SLUGS)) {
      const expectedPermissions = SYSTEM_ROLE_PERMISSIONS[roleSlug];

      const { ruleSetId, insertedCount: systemRowsInsertedCount } =
        await this.ensureSystemRoleAndRuleSet(tenantId, roleSlug);

      insertedCount += systemRowsInsertedCount;

      const existingPermissions = await this.db
        .selectDistinct({
          permission: permissionRuleSetPermissions.permission,
        })
        .from(permissionRuleSetPermissions)
        .where(
          and(
            eq(permissionRuleSetPermissions.tenantId, tenantId),
            eq(permissionRuleSetPermissions.ruleSetId, ruleSetId),
          ),
        );

      const existingPermissionSet = new Set(existingPermissions.map((row) => row.permission));

      const missingPermissions = expectedPermissions.filter(
        (permission) => !existingPermissionSet.has(permission),
      );

      if (!missingPermissions.length) continue;

      await this.db
        .insert(permissionRuleSetPermissions)
        .values(
          missingPermissions.map((permission) => ({
            tenantId,
            ruleSetId,
            permission,
          })),
        )
        .onConflictDoNothing({
          target: [permissionRuleSetPermissions.ruleSetId, permissionRuleSetPermissions.permission],
        });

      insertedCount += missingPermissions.length;
    }

    return insertedCount;
  }

  private async ensureSystemRoleAndRuleSet(tenantId: UUIDType, roleSlug: SystemRoleSlug) {
    const roleDisplayName = this.systemRoleDisplayName[roleSlug];
    const ruleSetSlug = SYSTEM_RULE_SET_SLUGS[roleSlug];
    let insertedCount = 0;

    const existingRole = await this.findRole(tenantId, roleSlug);
    const [role] = await this.db
      .insert(permissionRoles)
      .values({
        tenantId,
        name: roleDisplayName,
        slug: roleSlug,
        isSystem: true,
      })
      .onConflictDoNothing({
        target: [permissionRoles.tenantId, permissionRoles.slug],
      })
      .returning({ id: permissionRoles.id });

    if (!existingRole) insertedCount += 1;
    const roleId = role?.id ?? existingRole?.id;

    if (!roleId) {
      throw new Error(`System role ${roleSlug} was not inserted or found for tenant ${tenantId}`);
    }

    const existingRuleSet = await this.findRuleSet(tenantId, ruleSetSlug);
    const [ruleSet] = await this.db
      .insert(permissionRuleSets)
      .values({
        tenantId,
        name: roleDisplayName,
        slug: ruleSetSlug,
        isSystem: true,
      })
      .onConflictDoNothing({
        target: [permissionRuleSets.tenantId, permissionRuleSets.slug],
      })
      .returning({ id: permissionRuleSets.id });

    if (!existingRuleSet) insertedCount += 1;
    const ruleSetId = ruleSet?.id ?? existingRuleSet?.id;

    if (!ruleSetId) {
      throw new Error(
        `System rule set ${ruleSetSlug} was not inserted or found for tenant ${tenantId}`,
      );
    }

    const existingRoleRuleSet = await this.findRoleRuleSet(tenantId, roleId, ruleSetId);

    await this.db
      .insert(permissionRoleRuleSets)
      .values({
        tenantId,
        roleId,
        ruleSetId,
      })
      .onConflictDoNothing({
        target: [permissionRoleRuleSets.roleId, permissionRoleRuleSets.ruleSetId],
      });

    if (!existingRoleRuleSet) insertedCount += 1;

    return { ruleSetId, insertedCount };
  }

  private async findRole(tenantId: UUIDType, roleSlug: SystemRoleSlug) {
    const [role] = await this.db
      .select({ id: permissionRoles.id })
      .from(permissionRoles)
      .where(and(eq(permissionRoles.tenantId, tenantId), eq(permissionRoles.slug, roleSlug)))
      .limit(1);

    return role;
  }

  private async findRuleSet(tenantId: UUIDType, ruleSetSlug: string) {
    const [ruleSet] = await this.db
      .select({ id: permissionRuleSets.id })
      .from(permissionRuleSets)
      .where(
        and(eq(permissionRuleSets.tenantId, tenantId), eq(permissionRuleSets.slug, ruleSetSlug)),
      )
      .limit(1);

    return ruleSet;
  }

  private async findRoleRuleSet(tenantId: UUIDType, roleId: UUIDType, ruleSetId: UUIDType) {
    const [roleRuleSet] = await this.db
      .select({ roleId: permissionRoleRuleSets.roleId })
      .from(permissionRoleRuleSets)
      .where(
        and(
          eq(permissionRoleRuleSets.tenantId, tenantId),
          eq(permissionRoleRuleSets.roleId, roleId),
          eq(permissionRoleRuleSets.ruleSetId, ruleSetId),
        ),
      )
      .limit(1);

    return roleRuleSet;
  }
}
