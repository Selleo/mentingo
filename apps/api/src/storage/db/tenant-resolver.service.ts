import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { tenants } from "src/storage/schema";

import { DB_BASE } from "./db.providers";

import type { Request } from "express";

@Injectable()
export class TenantResolverService {
  constructor(@Inject(DB_BASE) private readonly dbBase: DatabasePg) {}

  async resolveTenantId(req: Request): Promise<string | null> {
    const userWithTenant = req.user as (Request["user"] & { tenantId?: string }) | undefined;

    if (userWithTenant?.tenantId) return userWithTenant.tenantId;

    const host = (req.headers.referer || "").slice(0, (req.headers.referer || "").lastIndexOf("/"));

    if (!host) return null;

    const [tenant] = await this.dbBase
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.host, host))
      .limit(1);

    return tenant?.id ?? null;
  }
}
