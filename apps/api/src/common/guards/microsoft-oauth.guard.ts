import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EnvService } from "src/env/services/env.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import { TenantOAuthGuard } from "./tenant-oauth.guard";

class MicrosoftOAuthGuardBase extends TenantOAuthGuard(
  "microsoft",
  (req: { oauthState?: string }, isCallback: boolean) =>
    isCallback ? {} : { state: req.oauthState },
) {}

@Injectable()
export class MicrosoftOAuthGuard extends MicrosoftOAuthGuardBase {
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
      .getEnv("MICROSOFT_OAUTH_ENABLED")
      .then((r) => r.value)
      .catch(() => this.configService.get<string>("MICROSOFT_OAUTH_ENABLED"));

    return enabled === "true";
  }

  protected handleDisabled(): boolean {
    throw new ForbiddenException("Microsoft OAuth is disabled");
  }
}
