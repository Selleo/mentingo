import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_TOKEN_PURPOSE } from "@repo/shared";

import { ALLOW_MFA } from "src/auth/session/allow-mfa.decorator";
import { SessionService } from "src/auth/session/session.service";
import { MCP_UPLOAD_TOKEN_PREFIX, McpUploadGrantService } from "src/mcp/mcp-upload-grant.service";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";
import { extractToken } from "src/utils/extract-token";

import type { McpRequest } from "src/mcp/mcp.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly reflector: Reflector,
    private readonly mcpUploadGrants: McpUploadGrantService,
    private readonly tenantResolverService: TenantResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", targets);
    const allowMfa = this.reflector.getAllAndOverride<boolean>(ALLOW_MFA, targets) ?? false;

    const request = context.switchToHttp().getRequest();
    if (this.isMcpUploadGrantRequest(request)) {
      return this.authenticateUploadGrant(request);
    }

    const token = extractToken(request, "access_token");

    request.user = null;
    if (!token) {
      if (isPublic) return true;

      // An unknown tenant is a missing resource; auth failures on known tenants remain 401.
      await this.tenantResolverService.resolveTenantId(request, true);
      throw new UnauthorizedException("Access token not found");
    }

    try {
      request.user = await this.sessionService.verifySessionToken(
        token,
        AUTH_TOKEN_PURPOSE.ACCESS,
        allowMfa,
      );
    } catch (error) {
      if (isPublic) return true;

      await this.tenantResolverService.resolveTenantId(request, true);
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException)
        throw error;

      throw new UnauthorizedException("Invalid access token");
    }

    return true;
  }

  private isMcpUploadGrantRequest(request: McpRequest): boolean {
    return request.headers.authorization?.startsWith(`Bearer ${MCP_UPLOAD_TOKEN_PREFIX}`) ?? false;
  }

  private async authenticateUploadGrant(request: McpRequest): Promise<boolean> {
    const { user, grant, token } = await this.mcpUploadGrants.authenticate(request);
    request.user = user;
    request.mcpUploadGrant = grant;
    request.mcpUploadGrantToken = token;
    return true;
  }
}
