import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";

import { McpResourceService } from "./mcp-resource.service";
import { McpTokenService } from "./mcp-token.service";

import type { McpRequest } from "./mcp.types";
import type { Response } from "express";

@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(
    private readonly resources: McpResourceService,
    private readonly tokens: McpTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<McpRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const resource = await this.resources.fromRequest(request);
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
    const actor = await this.tokens.resolve(token, resource.url);

    if (!actor || actor.grant.tenantId !== resource.tenantId) {
      const metadataUrl = new URL("/.well-known/oauth-protected-resource/api/mcp", resource.origin);
      response.setHeader("WWW-Authenticate", `Bearer resource_metadata="${metadataUrl.href}"`);
      throw new UnauthorizedException("unauthorized");
    }

    request.mcpActor = actor;
    return true;
  }
}
