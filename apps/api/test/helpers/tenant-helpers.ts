import { eq } from "drizzle-orm";

import { tenants } from "src/storage/schema";

import type { DatabasePg, UUIDType } from "src/common";

export const DEFAULT_TEST_TENANT_HOST = "https://tenant.local";

export async function ensureTenant(db: DatabasePg, tenantId?: UUIDType): Promise<UUIDType> {
  if (tenantId) {
    const [existingTenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (existingTenant) return existingTenant.id;
  }

  const [defaultTenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.host, DEFAULT_TEST_TENANT_HOST))
    .limit(1);

  if (defaultTenant) return defaultTenant.id;

  const [{ id: newTenantId }] = await db
    .insert(tenants)
    .values({
      name: "Test Tenant",
      host: DEFAULT_TEST_TENANT_HOST,
    })
    .returning({ id: tenants.id });

  return newTenantId;
}
