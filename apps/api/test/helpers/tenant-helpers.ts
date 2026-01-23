import { eq } from "drizzle-orm";

import { tenants } from "src/storage/schema";

import type { DatabasePg, UUIDType } from "src/common";

export async function ensureTenant(db: DatabasePg, tenantId?: UUIDType): Promise<UUIDType> {
  if (tenantId) {
    const [existingTenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (existingTenant) {
      return existingTenant.id;
    }
  }

  const [firstExisting] = await db.select({ id: tenants.id }).from(tenants).limit(1);

  if (firstExisting) {
    return firstExisting.id;
  }

  const [createdTenant] = await db
    .insert(tenants)
    .values({
      id: tenantId,
      name: "Test Tenant",
      host: "tenant.local",
    })
    .returning({ id: tenants.id });

  return createdTenant.id;
}
