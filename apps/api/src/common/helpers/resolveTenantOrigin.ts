import { eq } from "drizzle-orm";

import { tenants } from "src/storage/schema";

import type { DatabasePg } from "src/common";

export const resolveTenantOrigin = async (
  dbAdmin: DatabasePg,
  tenantId: string,
  fallbackOrigin?: string,
) => {
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");

  const [tenant] = await dbAdmin
    .select({ host: tenants.host })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return tenant?.host?.replace(/\/$/, "") || process.env.CORS_ORIGIN || "http://localhost:5173";
};
