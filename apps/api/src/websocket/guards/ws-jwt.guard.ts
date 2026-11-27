import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  HttpException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import { AUTH_ERROR_KEYS, AUTH_SOCKET_EVENTS, AUTH_TOKEN_PURPOSE } from "@repo/shared";
import { parse } from "cookie";

import { SessionService } from "src/auth/session/session.service";
import { getSessionRoomName, getUserRoomName } from "src/websocket/websocket.rooms";

import { WsAuthenticationException } from "./ws-authentication.exception";

import type { AuthenticatedSocket, WsUser } from "src/websocket/websocket.types";

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();

    return this.authenticateCurrent(client);
  }

  /** Revalidates the session on every message so revoked sessions lose live subscriptions. */
  async authenticateCurrent(client: AuthenticatedSocket): Promise<boolean> {
    const token = this.extractToken(client);

    if (!token) {
      this.logger.debug("No token provided for WebSocket connection");
      client.disconnect(true);
      throw new WsAuthenticationException("Unauthorized: No token provided");
    }

    try {
      const payload = await this.sessionService.verifySessionToken(
        token,
        AUTH_TOKEN_PURPOSE.ACCESS,
      );
      if (!payload.sessionId) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);
      if (!payload.accessVersion) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);

      const user: WsUser = {
        userId: payload.userId,
        sessionId: payload.sessionId,
        sessionVersion: payload.sessionVersion,
        accessVersion: payload.accessVersion,
        email: payload.email,
        roleSlugs: payload.roleSlugs ?? [],
        permissions: payload.permissions ?? [],
        tenantId: payload.tenantId,
      };

      // A queued voice packet may finish authentication after cancellation/queue overflow
      // disconnected its socket. Never let that late guard invoke the audio handler.
      this.assertSocketConnected(client);

      client.data = { ...client.data, user };

      await client.join(getUserRoomName(user.userId));
      await client.join(getSessionRoomName(user.sessionId));

      this.assertSocketConnected(client);
      this.logger.debug(`WebSocket authenticated for user: ${user.userId}`);

      return true;
    } catch (error) {
      if (!this.isCredentialFailure(error)) {
        this.logger.warn({
          event: "websocket_authentication_unavailable",
          errorName: error instanceof Error ? error.name : typeof error,
        });
        throw new WsException("Authentication temporarily unavailable");
      }
      if (this.isRefreshableExpiry(error)) client.emit(AUTH_SOCKET_EVENTS.SESSION_EXPIRED);
      client.disconnect(true);
      if (error instanceof WsAuthenticationException) throw error;

      this.logger.debug("WebSocket credentials rejected");
      throw new WsAuthenticationException("Unauthorized: Invalid token");
    }
  }

  private assertSocketConnected(client: AuthenticatedSocket): void {
    if (client.connected === false)
      throw new WsAuthenticationException("Unauthorized: Socket disconnected");
  }

  /** JWT expiry and outdated access versions keep the session, so the client can refresh and reconnect. */
  private isRefreshableExpiry(error: unknown): boolean {
    if (error instanceof UnauthorizedException)
      return error.message === AUTH_ERROR_KEYS.SESSION_EXPIRED;
    return error instanceof Error && error.name === "TokenExpiredError";
  }

  /** Only explicit access denials and JWT validation errors terminate a browser session. */
  private isCredentialFailure(error: unknown): boolean {
    if (error instanceof WsAuthenticationException) return true;
    if (error instanceof HttpException) return [401, 403].includes(error.getStatus());
    return (
      error instanceof Error &&
      ["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(error.name)
    );
  }

  private extractToken(client: AuthenticatedSocket): string | null {
    const authToken = client.handshake?.auth?.token;
    if (authToken) {
      return authToken;
    }

    const cookies = client.handshake?.headers?.cookie;
    if (cookies) {
      const parsed = parse(cookies);

      if (parsed.access_token) {
        return parsed.access_token;
      }
    }

    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.split(" ")[1];
    }

    return null;
  }
}
