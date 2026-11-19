import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";

import { WsAuthenticationException } from "./ws-authentication.exception";
import { WsJwtGuard } from "./ws-jwt.guard";

import type { ExecutionContext } from "@nestjs/common";
import type { SessionService } from "src/auth/session/session.service";

jest.mock("src/auth/session/session.service", () => ({ SessionService: class {} }));

describe("WebSocket credential expiry", () => {
  it.each([
    [Object.assign(new Error("expired"), { name: "TokenExpiredError" }), true],
    [new UnauthorizedException("auth.error.sessionRevoked"), false],
    [new ForbiddenException("auth.error.mfaRequired"), false],
    [Object.assign(new Error("invalid"), { name: "JsonWebTokenError" }), false],
    [Object.assign(new Error("future token"), { name: "NotBeforeError" }), false],
  ])("only offers refresh recovery for JWT expiry: %s", async (error, recoverable) => {
    const client = {
      handshake: { headers: { cookie: "access_token=old-token" } },
      data: { user: { userId: "cached-user" } },
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const verifySessionToken = jest.fn().mockRejectedValue(error);
    const guard = new WsJwtGuard({ verifySessionToken } as unknown as SessionService);
    const context = {
      switchToWs: () => ({ getClient: () => client }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(WsException);
    expect(verifySessionToken).toHaveBeenCalledWith("old-token", "access");
    expect(client.disconnect).toHaveBeenCalledWith(true);
    if (recoverable) {
      expect(client.emit).toHaveBeenCalledWith("auth:expired");
      expect(client.emit.mock.invocationCallOrder[0]).toBeLessThan(
        client.disconnect.mock.invocationCallOrder[0],
      );
    } else {
      expect(client.emit).not.toHaveBeenCalled();
    }
  });

  it("fails closed without disconnecting or offering token refresh during a transient verification outage", async () => {
    const unavailable = new Error("Redis unavailable");
    const verifySessionToken = jest.fn().mockRejectedValueOnce(unavailable).mockResolvedValue({
      userId: "verified-user",
      sessionId: "verified-session",
      tenantId: "verified-tenant",
    });
    const client = {
      connected: true,
      handshake: { auth: { token: "synthetic-token" } },
      data: { user: { userId: "cached-user" } },
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const guard = new WsJwtGuard({ verifySessionToken } as unknown as SessionService);
    const context = {
      switchToWs: () => ({ getClient: () => client }),
    } as unknown as ExecutionContext;

    const rejection = guard.canActivate(context);
    await expect(rejection).rejects.toBeInstanceOf(WsException);
    await expect(rejection).rejects.not.toBeInstanceOf(WsAuthenticationException);
    await expect(rejection).rejects.toThrow("Authentication temporarily unavailable");
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
    expect(client.data.user.userId).toBe("cached-user");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(client.data.user.userId).toBe("verified-user");
  });
});

describe("Disconnected voice ingress", () => {
  it("does not authorize a packet whose socket disconnected during verification", async () => {
    const client = {
      connected: true,
      handshake: { auth: { token: "synthetic-token" } },
      data: { user: { userId: "cached-user" } },
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const guard = new WsJwtGuard({
      verifySessionToken: async () => {
        client.connected = false;
        return {
          userId: "synthetic-user",
          sessionId: "synthetic-session",
          tenantId: "synthetic-tenant",
        };
      },
    } as unknown as SessionService);
    await expect(
      guard.canActivate({
        switchToWs: () => ({ getClient: () => client }),
      } as unknown as ExecutionContext),
    ).rejects.toBeInstanceOf(WsException);
    expect(client.join).not.toHaveBeenCalled();
    expect(client.data.user.userId).toBe("cached-user");
  });
});
