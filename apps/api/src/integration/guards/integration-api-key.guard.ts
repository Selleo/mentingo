import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

import { IntegrationService } from "src/integration/integration.service";

import type { IntegrationRequest } from "src/integration/integration.types";

@Injectable()
export class IntegrationApiKeyGuard implements CanActivate {
  constructor(private readonly integrationService: IntegrationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<IntegrationRequest>();

    const apiKeyHeader = req.headers["x-api-key"];
    const tenantIdHeader = req.headers["x-tenant-id"];

    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    const tenantId = Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;

    if (!apiKey || typeof apiKey !== "string") {
      throw new UnauthorizedException("integrationApiKey.errors.missingApiKeyHeader");
    }

    if (!tenantId || typeof tenantId !== "string") {
      throw new UnauthorizedException("integrationApiKey.errors.missingTenantIdHeader");
    }

    const { user, keyId } = await this.integrationService.authenticateApiKey(apiKey, tenantId);

    req.user = user;
    req.integrationTenantValidated = true;
    req.integrationApiKeyId = keyId;

    await this.integrationService.markKeyAsUsed(keyId);

    return true;
  }
}
