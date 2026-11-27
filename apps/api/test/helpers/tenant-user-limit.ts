import { TENANT_USER_CAPACITY_ALERT_LEVELS } from "@repo/shared";
import { eq } from "drizzle-orm";

import { tenants } from "src/storage/schema";

import { createUserFactory } from "../factory/user.factory";

import { cookieFor } from "./test-helpers";

import type { UserWithCredentials } from "../factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

export const TENANT_USER_LIMIT_TEST_PASSWORD = "Password123@";

export type TenantUserLimitTestContext = {
  app: INestApplication;
  db: DatabasePg;
  dbAdmin: DatabasePg;
  tenantId: UUIDType;
  runAsTenant: <T>(tenantId: UUIDType, callback: () => Promise<T>) => Promise<T>;
};

export type TenantUserLimit = {
  maxUsers: number | null;
  maxUsersOverflowPercentage: number;
};

export type SignedInUser = { user: UserWithCredentials; cookie: string };

/** The tenant row survives table truncation, so specs restore its limit between tests. */
export async function resetTenantUserLimit({ dbAdmin, tenantId }: TenantUserLimitTestContext) {
  await dbAdmin
    .update(tenants)
    .set({
      maxUsers: null,
      maxUsersOverflowPercentage: 0,
      userCapacityAlertLevel: TENANT_USER_CAPACITY_ALERT_LEVELS.WITHIN_LIMIT,
      isManaging: false,
    })
    .where(eq(tenants.id, tenantId));
}

/** Sets the limit directly, as a super admin would have before the users were seeded. */
export async function setTenantUserLimit(
  { dbAdmin, tenantId }: TenantUserLimitTestContext,
  userLimit: TenantUserLimit,
) {
  await dbAdmin.update(tenants).set(userLimit).where(eq(tenants.id, tenantId));
}

export async function makeTenantManaging({ dbAdmin, tenantId }: TenantUserLimitTestContext) {
  await dbAdmin.update(tenants).set({ isManaging: true }).where(eq(tenants.id, tenantId));
}

export async function arrangeAdmin(
  { db, tenantId, runAsTenant }: TenantUserLimitTestContext,
  overrides: Partial<UserWithCredentials> = {},
): Promise<UserWithCredentials> {
  return runAsTenant(tenantId, () =>
    createUserFactory(db)
      .withCredentials({ password: TENANT_USER_LIMIT_TEST_PASSWORD })
      .withAdminSettings(db)
      .create({ tenantId, ...overrides }),
  );
}

export async function arrangeTenantAdmin(
  context: TenantUserLimitTestContext,
): Promise<SignedInUser> {
  const user = await arrangeAdmin(context);

  return { user, cookie: await cookieFor(user, context.app) };
}

export async function arrangeStudents(
  { db, tenantId, runAsTenant }: TenantUserLimitTestContext,
  count: number,
  overrides: Partial<UserWithCredentials> = {},
): Promise<UserWithCredentials[]> {
  return runAsTenant(tenantId, async () => {
    const students: UserWithCredentials[] = [];

    for (let index = 0; index < count; index++) {
      students.push(
        await createUserFactory(db)
          .withCredentials({ password: TENANT_USER_LIMIT_TEST_PASSWORD })
          .withUserSettings(db)
          .create({ tenantId, ...overrides }),
      );
    }

    return students;
  });
}

/** Seeds a signed-in admin plus students, so the tenant has exactly `activeUsersCount` users. */
export async function arrangeTenantWithActiveUsers(
  context: TenantUserLimitTestContext,
  activeUsersCount: number,
) {
  const admin = await arrangeTenantAdmin(context);
  const students = await arrangeStudents(context, activeUsersCount - 1);

  return { admin, students };
}
