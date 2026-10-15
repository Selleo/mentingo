import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";

import { McpAuthGuard } from "./mcp-auth.guard";
import { MCP_SCOPES } from "./mcp-tool-scope";

import type { McpRequest, McpToolActor } from "./mcp.types";

describe("MCP OAuth challenge scope", () => {
  const resource = {
    tenantId: "tenant",
    origin: "https://tenant.example.test",
    url: "https://tenant.example.test/api/mcp",
  };

  function setup(actor: McpToolActor | null) {
    const request = { headers: {} } as McpRequest;
    const response = { setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as ExecutionContext;
    const resources = { fromRequest: jest.fn().mockResolvedValue(resource) };
    const tokens = { resolve: jest.fn().mockResolvedValue(actor) };
    const guard = new McpAuthGuard(resources as never, tokens as never);
    return { guard, context, request, response };
  }

  it("requests account access for a standard client without combining exclusive scopes", async () => {
    const { guard, context, response } = setup(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(response.setHeader).toHaveBeenCalledWith(
      "WWW-Authenticate",
      'Bearer resource_metadata="https://tenant.example.test/.well-known/oauth-protected-resource/api/mcp", scope="account:access"',
    );
  });

  it("keeps an explicitly limited student grant unchanged without reauthorization", async () => {
    const actor: McpToolActor = {
      email: "learner@example.test",
      grant: {
        userId: "learner",
        tenantId: resource.tenantId,
        clientId: "limited-client",
        resource: resource.url,
        scopes: [MCP_SCOPES.STUDENT_READ],
        expiresAt: Date.now() + 60_000,
      },
    };
    const { guard, context, request, response } = setup(actor);
    request.headers.authorization = "Bearer limited-token";
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.mcpActor).toBe(actor);
    expect(request.mcpActor?.grant.scopes).toEqual([MCP_SCOPES.STUDENT_READ]);
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
