import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { INTEGRATION_TENANT_OPTIONAL } from "src/integration/decorators/tenant-optional.decorator";
import { IntegrationService } from "src/integration/integration.service";

import type { IntegrationRequest } from "src/integration/integration.types";

@Injectable()
export class IntegrationApiKeyGuard implements CanActivate {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<IntegrationRequest>();

    const apiKeyHeader = req.headers["x-api-key"];
    const tenantIdHeader = req.headers["x-tenant-id"];

    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    const tenantId = Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;

    if (!apiKey || typeof apiKey !== "string") {
      throw new UnauthorizedException("integrationApiKey.errors.missingApiKeyHeader");
    }

    const tenantOptional = this.reflector.getAllAndOverride<boolean>(INTEGRATION_TENANT_OPTIONAL, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!tenantOptional && (!tenantId || typeof tenantId !== "string")) {
      throw new UnauthorizedException("integrationApiKey.errors.missingTenantIdHeader");
    }

    const { user, keyId } = await this.integrationService.authenticateApiKey(apiKey);

    if (tenantId && typeof tenantId === "string") {
      user.tenantId = tenantId;
    }

    req.user = user;
    req.integrationTenantValidated = true;
    req.integrationApiKeyId = keyId;

    await this.integrationService.markKeyAsUsed(keyId);

    return true;
  }
}
