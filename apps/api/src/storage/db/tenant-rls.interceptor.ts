import { Injectable, UnauthorizedException } from "@nestjs/common";
import { defer, lastValueFrom } from "rxjs";

import { TenantDbRunnerService } from "./tenant-db-runner.service";
import { TenantResolverService } from "./tenant-resolver.service";

import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
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

    if (path && path.includes("/api/healthcheck")) {
      return next.handle();
    }

    return defer(async () => {
      const tenantId = await this.tenantResolver.resolveTenantId(req);

      if (!tenantId) throw new UnauthorizedException("Missing tenantId");

      return this.runner.runWithTenant(tenantId, () => lastValueFrom(next.handle()));
    });
  }
}
