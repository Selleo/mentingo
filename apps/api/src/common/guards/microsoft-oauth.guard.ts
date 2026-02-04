import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EnvService } from "src/env/services/env.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import { createTenantOAuthGuard } from "./oauth-guard.factory";

class MicrosoftOAuthGuardBase extends createTenantOAuthGuard(
  "microsoft",
  (req: { oauthState?: string }, isCallback: boolean) =>
    isCallback ? {} : { state: req.oauthState },
  "MICROSOFT_OAUTH_ENABLED",
  "Microsoft OAuth is disabled",
) {}

@Injectable()
export class MicrosoftOAuthGuard extends MicrosoftOAuthGuardBase {
  constructor(
    envService: EnvService,
    configService: ConfigService,
    tenantResolver: TenantResolverService,
    tenantState: TenantStateService,
  ) {
    super(envService, configService, tenantResolver, tenantState);
  }
}
