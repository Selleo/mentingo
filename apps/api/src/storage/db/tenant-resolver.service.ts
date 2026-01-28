import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { tenants } from "src/storage/schema";

import { DB_BASE } from "./db.providers";

import type { Request } from "express";

@Injectable()
export class TenantResolverService {
  constructor(@Inject(DB_BASE) private readonly dbBase: DatabasePg) {}

  async resolveTenantId(req: Request): Promise<string | null> {
    const user = req.user as (Request["user"] & { tenantId?: string }) | undefined;
    const origin = this.getRequestOrigin(req);

    if (user?.tenantId) {
      const [tenant] = await this.dbBase
        .select()
        .from(tenants)
        .where(eq(tenants.id, user.tenantId))
        .limit(1);

      if (tenant?.host !== origin) throw new UnauthorizedException("Tenant host mismatch");

      return user.tenantId;
    }

    if (!origin) return null;

    const [tenant] = await this.dbBase
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.host, origin))
      .limit(1);

    return tenant?.id ?? null;
  }

  private getRequestOrigin(req: Request): string | null {
    const fromHeader = this.safeParseOrigin(req.headers.referer ?? req.headers.origin);
    if (fromHeader) return fromHeader;

    const host = req.headers.host;
    if (!host) return null;

    const protocol = (req.protocol as string | undefined) ?? "http";
    return `${protocol}://${host}`.replace(/\/$/, "");
  }

  private safeParseOrigin(value?: string): string | null {
    if (!value) return null;

    try {
      return new URL(value).origin.replace(/\/$/, "");
    } catch {
      return null;
    }
  }
}
