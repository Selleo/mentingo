import { Injectable, UnauthorizedException } from "@nestjs/common";
import { defer, lastValueFrom } from "rxjs";

import { TenantDbRunnerService } from "./tenant-db-runner.service";
import { TenantResolverService } from "./tenant-resolver.service";

import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  private static readonly BYPASSED_PATHS = new Set<string>([
    "/api/healthcheck",
    "/api/integration/tenants",
    "/api/certificates/share",
    "/api/certificates/share-image",
  ]);

  constructor(
    private readonly runner: TenantDbRunnerService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (ctx.getType() !== "http") {
      return next.handle();
    }

    const req = ctx.switchToHttp().getRequest();

    const { path } = req;

    if (path && this.shouldBypassTenantResolution(path)) {
      return next.handle();
    }

    return defer(async () => {
      const tenantId = await this.tenantResolver.resolveTenantId(req);

      if (!tenantId) throw new UnauthorizedException("Missing tenantId");

      return this.runner.runWithTenant(tenantId, () => lastValueFrom(next.handle()));
    });
  }

  private shouldBypassTenantResolution(path: string): boolean {
    if (TenantRlsInterceptor.BYPASSED_PATHS.has(path)) return true;

    const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;
    return TenantRlsInterceptor.BYPASSED_PATHS.has(normalizedPath);
  }
}
