import { Inject, Injectable, Logger } from "@nestjs/common";
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

import type { OnApplicationBootstrap } from "@nestjs/common";
import type { UUIDType } from "src/common";

@Injectable()
export class PermissionsBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionsBackfillService.name);

  constructor(
    private readonly tenantDbRunner: TenantDbRunnerService,
    @Inject(DB) private readonly db: DatabasePg,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.JEST_WORKER_ID) return;

    const { insertedCount, tenantCount } = await this.backfillMissingPermissionsForAllTenants();

    if (insertedCount > 0) {
      this.logger.warn(
        `Backfilled ${insertedCount} missing permission rows across ${tenantCount} tenants`,
      );
    } else {
      this.logger.warn(`Permission backfill found no missing rows across ${tenantCount} tenants`);
    }
  }

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
      const ruleSetSlug = SYSTEM_RULE_SET_SLUGS[roleSlug];
      const expectedPermissions = SYSTEM_ROLE_PERMISSIONS[roleSlug];

      const [ruleSet] = await this.db
        .select({ id: permissionRuleSets.id })
        .from(permissionRoles)
        .innerJoin(
          permissionRoleRuleSets,
          and(
            eq(permissionRoleRuleSets.roleId, permissionRoles.id),
            eq(permissionRoleRuleSets.tenantId, permissionRoles.tenantId),
          ),
        )
        .innerJoin(
          permissionRuleSets,
          and(
            eq(permissionRuleSets.id, permissionRoleRuleSets.ruleSetId),
            eq(permissionRuleSets.tenantId, permissionRoleRuleSets.tenantId),
          ),
        )
        .where(
          and(
            eq(permissionRoles.tenantId, tenantId),
            eq(permissionRoles.slug, roleSlug),
            eq(permissionRuleSets.slug, ruleSetSlug),
          ),
        )
        .limit(1);

      if (!ruleSet) {
        this.logger.warn(
          `Skipping permission backfill for tenant ${tenantId} because system rule set ${ruleSetSlug} is missing`,
        );

        continue;
      }

      const existingPermissions = await this.db
        .selectDistinct({
          permission: permissionRuleSetPermissions.permission,
        })
        .from(permissionRuleSetPermissions)
        .where(
          and(
            eq(permissionRuleSetPermissions.tenantId, tenantId),
            eq(permissionRuleSetPermissions.ruleSetId, ruleSet.id),
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
            ruleSetId: ruleSet.id,
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
}
