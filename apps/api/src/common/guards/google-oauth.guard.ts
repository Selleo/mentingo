import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EnvService } from "src/env/services/env.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import { TenantOAuthGuard } from "./tenant-oauth.guard";

class GoogleOAuthGuardBase extends TenantOAuthGuard(
  "google",
  (req: { oauthState?: string }, isCallback: boolean) =>
    isCallback
      ? { accessType: "offline", prompt: "consent" }
      : { accessType: "offline", prompt: "consent", state: req.oauthState },
) {}

@Injectable()
export class GoogleOAuthGuard extends GoogleOAuthGuardBase {
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
      .getEnv("GOOGLE_OAUTH_ENABLED")
      .then((r) => r.value)
      .catch(() => this.configService.get<string>("GOOGLE_OAUTH_ENABLED"));

    return enabled === "true";
  }

  protected handleDisabled(): boolean {
    throw new ForbiddenException("Google OAuth is disabled");
  }
}
