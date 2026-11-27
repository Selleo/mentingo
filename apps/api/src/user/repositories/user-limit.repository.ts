import { Injectable } from "@nestjs/common";
import { PERMISSIONS, type TenantUserCapacityAlertLevel } from "@repo/shared";
import { and, asc, count, eq, isNull } from "drizzle-orm";

import { userHasPermissionCondition } from "src/common/permissions/permission-sql.utils";
import { tenants, users } from "src/storage/schema";

import type { UUIDType, DatabasePg } from "src/common";
import type {
  TenantUserCapacityAlertRecipient,
  TenantUserLimit,
} from "src/user/types/tenant-user-limit.types";

@Injectable()
export class UserLimitRepository {
  /** Locks the tenant row so concurrent user creations in the tenant check the limit one by one. */
  async lockTenantUserLimit(
    tenantId: UUIDType,
    dbInstance: DatabasePg,
  ): Promise<TenantUserLimit | null> {
    const [tenantUserLimit] = await dbInstance
      .select({
        maxUsers: tenants.maxUsers,
        maxUsersOverflowPercentage: tenants.maxUsersOverflowPercentage,
        userCapacityAlertLevel: tenants.userCapacityAlertLevel,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .for("no key update");

    return tenantUserLimit ?? null;
  }

  async countActiveUsers(tenantId: UUIDType, dbInstance: DatabasePg): Promise<number> {
    const [{ activeUsersCount }] = await dbInstance
      .select({ activeUsersCount: count() })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.archived, false), isNull(users.deletedAt)));

    return activeUsersCount;
  }

  async updateUserCapacityAlertLevel(
    tenantId: UUIDType,
    userCapacityAlertLevel: TenantUserCapacityAlertLevel,
    dbInstance: DatabasePg,
  ) {
    await dbInstance
      .update(tenants)
      .set({ userCapacityAlertLevel })
      .where(eq(tenants.id, tenantId));
  }

  /** Active tenant admins, oldest first. */
  async findUserCapacityAlertRecipients(
    tenantId: UUIDType,
    dbInstance: DatabasePg,
  ): Promise<TenantUserCapacityAlertRecipient[]> {
    return dbInstance
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.archived, false),
          isNull(users.deletedAt),
          userHasPermissionCondition(
            dbInstance,
            users.id,
            users.tenantId,
            PERMISSIONS.TENANT_MANAGE,
          ),
        ),
      )
      .orderBy(asc(users.createdAt), asc(users.id));
  }
}
