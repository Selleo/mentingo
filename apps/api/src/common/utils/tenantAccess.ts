import { TENANT_STATUSES, type TenantStatus } from "@repo/shared";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import { tenants } from "src/storage/schema";

export type TenantAccessState = {
  status: TenantStatus;
  accessEndsAt: string | null;
};

/** A tenant has access while it is active and its access end date, if set, is still ahead. */
export function isTenantAccessActive(tenant: TenantAccessState, now = new Date()): boolean {
  return (
    tenant.status === TENANT_STATUSES.ACTIVE && !hasTenantAccessEnded(tenant.accessEndsAt, now)
  );
}

export function tenantAccessActiveCondition() {
  return and(
    eq(tenants.status, TENANT_STATUSES.ACTIVE),
    or(isNull(tenants.accessEndsAt), gt(tenants.accessEndsAt, sql`now()`)),
  );
}

function hasTenantAccessEnded(accessEndsAt: string | null, now: Date) {
  return accessEndsAt !== null && new Date(accessEndsAt).getTime() <= now.getTime();
}
