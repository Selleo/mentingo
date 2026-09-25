import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { TENANT_STATUSES } from "@repo/shared";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { tenants } from "src/storage/schema";

import type { McpResource } from "./mcp.types";
import type { Request } from "express";

@Injectable()
export class McpResourceService {
  constructor(@Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg) {}

  async fromRequest(request: Request): Promise<McpResource> {
    const host = request.get("host");
    if (!host) throw new UnauthorizedException("Unknown MCP tenant host");

    let origin: string;
    try {
      origin = new URL(`${request.protocol}://${host}`).origin;
    } catch {
      throw new UnauthorizedException("Unknown MCP tenant host");
    }
    const [tenant] = await this.dbAdmin
      .select({ id: tenants.id, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.host, origin))
      .limit(1);
    if (!tenant || tenant.status !== TENANT_STATUSES.ACTIVE) {
      throw new UnauthorizedException("Unknown MCP tenant host");
    }
    return { tenantId: tenant.id, origin, url: `${origin}/api/mcp` };
  }

  async forTenant(tenantId: string): Promise<McpResource> {
    const [tenant] = await this.dbAdmin
      .select({ host: tenants.host, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant || tenant.status !== TENANT_STATUSES.ACTIVE) {
      throw new UnauthorizedException("MCP tenant is inactive");
    }
    const origin = new URL(tenant.host).origin;
    return { tenantId, origin, url: `${origin}/api/mcp` };
  }
}
