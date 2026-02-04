import { ForbiddenException, type Type } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EnvService } from "src/env/services/env.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import { TenantOAuthGuard } from "./tenant-oauth.guard";

import type { IAuthGuard } from "@nestjs/passport";

export type OAuthStateRequest = { oauthState?: string };

export type OAuthOptionsFactory = (
  req: OAuthStateRequest,
  isCallback: boolean,
) => Record<string, unknown>;

export const createTenantOAuthGuard = (
  provider: string,
  factoryOptions: OAuthOptionsFactory,
  envKey: string,
  disabledMessage: string,
): Type<IAuthGuard> => {
  class OAuthGuardBase extends TenantOAuthGuard(provider, factoryOptions) {
    constructor(
      private readonly envService: EnvService,
      private readonly configService: ConfigService,
      tenantResolver: TenantResolverService,
      tenantState: TenantStateService,
    ) {
      super(tenantResolver, tenantState);
    }

    protected async isEnabled(): Promise<boolean> {
      const enabled = await this.envService
        .getEnv(envKey)
        .then((r) => r.value)
        .catch(() => this.configService.get<string>(envKey));

      return enabled === "true";
    }

    protected handleDisabled(): boolean {
      throw new ForbiddenException(disabledMessage);
    }
  }

  return OAuthGuardBase;
};
