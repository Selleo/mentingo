import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EnvService } from "src/env/services/env.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import { TenantOAuthGuard } from "./tenant-oauth.guard";

class SlackOAuthGuardBase extends TenantOAuthGuard(
  "slack",
  (req: { oauthState?: string }, isCallback: boolean) =>
    isCallback ? {} : { state: req.oauthState },
) {}

@Injectable()
export class SlackOAuthGuard extends SlackOAuthGuardBase {
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
      .getEnv("SLACK_OAUTH_ENABLED")
      .then((r) => r.value)
      .catch(() => this.configService.get<string>("SLACK_OAUTH_ENABLED"));

    return enabled === "true";
  }

  protected handleDisabled(): boolean {
    throw new ForbiddenException("Slack OAuth is disabled");
  }
}
