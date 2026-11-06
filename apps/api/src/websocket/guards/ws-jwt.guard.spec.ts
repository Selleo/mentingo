import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";

import { WsJwtGuard } from "./ws-jwt.guard";

import type { ExecutionContext } from "@nestjs/common";
import type { SessionService } from "src/auth/session/session.service";

describe("WebSocket credential expiry", () => {
  it.each([
    [Object.assign(new Error("expired"), { name: "TokenExpiredError" }), true],
    [new UnauthorizedException("auth.error.sessionRevoked"), false],
    [new ForbiddenException("auth.error.mfaRequired"), false],
    [new Error("Redis unavailable"), false],
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
});
