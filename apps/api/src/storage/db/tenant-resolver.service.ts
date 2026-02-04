import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { tenants } from "src/storage/schema";

import { DB_BASE } from "./db.providers";
import { TenantStateService } from "./tenant-state.service";

import type { Request } from "express";

@Injectable()
export class TenantResolverService {
  constructor(
    @Inject(DB_BASE) private readonly dbBase: DatabasePg,
    private readonly tenantState: TenantStateService,
  ) {}

  async resolveTenantId(req: Request): Promise<string | null> {
    const tenantIdFromState = await this.resolveFromState(req);
    if (tenantIdFromState) return tenantIdFromState;

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

  private async resolveFromState(req: Request): Promise<string | null> {
    const path = (req.path ?? req.url ?? "") as string;
    if (!path.includes("/api/auth/") || !path.includes("/callback")) return null;

    const state = req.query?.state;
    if (!state || typeof state !== "string") return null;

    const tenantId = await this.tenantState.verify(state);

    if (!tenantId) throw new UnauthorizedException("Invalid tenant state");

    const [tenant] = await this.dbBase
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw new UnauthorizedException("Invalid tenant state");

    return tenant.id;
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
