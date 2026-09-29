import { UnauthorizedException } from "@nestjs/common";

import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";

import type { ExecutionContext } from "@nestjs/common";

const createContext = (request: unknown, isPublic = false) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
    __isPublic: isPublic,
  }) as unknown as ExecutionContext;

function buildGuard({
  isPublic = false,
  jwtPayload,
  isRevoked = false,
  mcpAuthenticate,
}: {
  isPublic?: boolean;
  jwtPayload?: Record<string, unknown>;
  isRevoked?: boolean;
  mcpAuthenticate?: jest.Mock;
} = {}) {
  const jwtService = {
    verifyAsync: jest.fn(() =>
      jwtPayload ? Promise.resolve(jwtPayload) : Promise.reject(new Error("invalid token")),
    ),
  };
  const reflector = { getAllAndOverride: jest.fn(() => isPublic) };
  const configService = { get: jest.fn(() => "secret") };
  const sessionRevocationService = { isUserRevoked: jest.fn(() => Promise.resolve(isRevoked)) };
  const mcpUploadGrants = { authenticate: mcpAuthenticate ?? jest.fn() };

  const guard = new JwtAuthGuard(
    jwtService as never,
    reflector as never,
    configService as never,
    sessionRevocationService as never,
    mcpUploadGrants as never,
  );

  return { guard, mcpUploadGrants };
}

describe("JwtAuthGuard", () => {
  it("authenticates a normal request via the access_token cookie", async () => {
    const { guard } = buildGuard({ jwtPayload: { userId: "user-1" } });
    const request: Record<string, unknown> = { cookies: { access_token: "jwt" }, headers: {} };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ userId: "user-1" });
  });

  it("rejects a protected request with no token", async () => {
    const { guard } = buildGuard();
    const request = { cookies: {}, headers: {} };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it("authenticates an MCP upload-grant request via the Bearer mcpup_ scheme", async () => {
    const grant = { targetType: "lesson" };
    const user = { userId: "user-2" };
    const mcpAuthenticate = jest.fn(() => Promise.resolve({ user, grant, token: "mcpup_abc" }));
    const { guard, mcpUploadGrants } = buildGuard({ mcpAuthenticate });
    const request: Record<string, unknown> = {
      cookies: {},
      headers: { authorization: "Bearer mcpup_abc" },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(mcpUploadGrants.authenticate).toHaveBeenCalledWith(request);
    expect(request.user).toBe(user);
    expect(request.mcpUploadGrant).toBe(grant);
    expect(request.mcpUploadGrantToken).toBe("mcpup_abc");
  });

  it("propagates rejection from an invalid MCP upload grant instead of falling back to JWT auth", async () => {
    const mcpAuthenticate = jest.fn(() =>
      Promise.reject(new UnauthorizedException("Upload grant expired or already used")),
    );
    const { guard } = buildGuard({ mcpAuthenticate });
    const request = { cookies: {}, headers: { authorization: "Bearer mcpup_bad" } };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      "Upload grant expired or already used",
    );
  });

  it("does not treat a legacy Upload-scheme header as an MCP upload grant", async () => {
    const mcpAuthenticate = jest.fn();
    const { guard } = buildGuard({ mcpAuthenticate });
    const request = { cookies: {}, headers: { authorization: "Upload mcpup_abc" } };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(UnauthorizedException);
    expect(mcpAuthenticate).not.toHaveBeenCalled();
  });
});
