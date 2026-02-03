import { mixin, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import type { ExecutionContext, Type } from "@nestjs/common";
import type { IAuthGuard } from "@nestjs/passport";

type AuthenticateOptionsProvider = (
  req: { oauthState?: string },
  isCallback: boolean,
) => Record<string, unknown>;

export function TenantOAuthGuard(
  strategy: string,
  authenticateOptionsProvider: AuthenticateOptionsProvider,
): Type<IAuthGuard> {
  class TenantOAuthGuardMixin extends AuthGuard(strategy) {
    constructor(
      private readonly tenantResolver: TenantResolverService,
      private readonly tenantState: TenantStateService,
    ) {
      super();
    }

    protected async isEnabled(): Promise<boolean> {
      return true;
    }

    protected handleDisabled(): boolean {
      return false;
    }

    async canActivate(context: ExecutionContext) {
      const enabled = await this.isEnabled();

      if (!enabled) return this.handleDisabled();

      const req = context.switchToHttp().getRequest();

      if (!this.isCallbackRequest(req)) {
        const tenantId = await this.tenantResolver.resolveTenantId(req);

        if (!tenantId) throw new UnauthorizedException("Missing tenantId");

        req.oauthState = await this.tenantState.sign(tenantId);
      }

      return super.canActivate(context) as any;
    }

    getAuthenticateOptions(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();
      const isCallback = this.isCallbackRequest(req);

      return authenticateOptionsProvider(req, isCallback);
    }

    private isCallbackRequest(req: { path?: string; url?: string }) {
      const path = req.path ?? req.url ?? "";

      return path.includes("/callback");
    }
  }

  return mixin(TenantOAuthGuardMixin);
}
