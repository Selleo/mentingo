import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EnvService } from "src/env/services/env.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import { createTenantOAuthGuard } from "./oauth-guard.factory";

class SlackOAuthGuardBase extends createTenantOAuthGuard(
  "slack",
  (req: { oauthState?: string }, isCallback: boolean) =>
    isCallback ? {} : { state: req.oauthState },
  "SLACK_OAUTH_ENABLED",
  "Slack OAuth is disabled",
) {}

@Injectable()
export class SlackOAuthGuard extends SlackOAuthGuardBase {
  constructor(
    envService: EnvService,
    configService: ConfigService,
    tenantResolver: TenantResolverService,
    tenantState: TenantStateService,
  ) {
    super(envService, configService, tenantResolver, tenantState);
  }
}
