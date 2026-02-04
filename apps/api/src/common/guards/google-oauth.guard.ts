import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EnvService } from "src/env/services/env.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import { createTenantOAuthGuard } from "./oauth-guard.factory";

class GoogleOAuthGuardBase extends createTenantOAuthGuard(
  "google",
  (req: { oauthState?: string }, isCallback: boolean) =>
    isCallback
      ? { accessType: "offline", prompt: "consent" }
      : { accessType: "offline", prompt: "consent", state: req.oauthState },
  "GOOGLE_OAUTH_ENABLED",
  "Google OAuth is disabled",
) {}

@Injectable()
export class GoogleOAuthGuard extends GoogleOAuthGuardBase {
  constructor(
    envService: EnvService,
    configService: ConfigService,
    tenantResolver: TenantResolverService,
    tenantState: TenantStateService,
  ) {
    super(envService, configService, tenantResolver, tenantState);
  }
}
