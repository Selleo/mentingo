import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LOGIN_METHOD_ERROR_KEYS } from "@repo/shared";

import { EnvService } from "src/env/services/env.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { TenantStateService } from "src/storage/db/tenant-state.service";

import { createTenantOAuthGuard } from "./oauth-guard.factory";

class EntraIdOAuthGuardBase extends createTenantOAuthGuard(
  "entra-id",
  (req: { oauthState?: string }, isCallback: boolean) =>
    isCallback ? {} : { state: req.oauthState },
  "ENTRA_ID_OAUTH_ENABLED",
  LOGIN_METHOD_ERROR_KEYS.DISABLED,
) {}

@Injectable()
export class EntraIdOAuthGuard extends EntraIdOAuthGuardBase {
  constructor(
    envService: EnvService,
    configService: ConfigService,
    tenantDbRunner: TenantDbRunnerService,
    tenantResolver: TenantResolverService,
    tenantState: TenantStateService,
  ) {
    super(envService, configService, tenantDbRunner, tenantResolver, tenantState);
  }
}
