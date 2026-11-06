import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import { AUTH_ERROR_KEYS, AUTH_SOCKET_EVENTS, AUTH_TOKEN_PURPOSE } from "@repo/shared";
import { parse } from "cookie";

import { SessionService } from "src/auth/session/session.service";
import { getSessionRoomName, getUserRoomName } from "src/websocket/websocket.rooms";

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
      throw new WsException("Unauthorized: No token provided");
    }

    try {
      const payload = await this.sessionService.verifySessionToken(
        token,
        AUTH_TOKEN_PURPOSE.ACCESS,
      );
      if (!payload.sessionId) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);

      const user: WsUser = {
        userId: payload.userId,
        sessionId: payload.sessionId,
        sessionVersion: payload.sessionVersion,
        email: payload.email,
        roleSlugs: payload.roleSlugs ?? [],
        permissions: payload.permissions ?? [],
        tenantId: payload.tenantId,
      };

      client.data = { ...client.data, user };

      await client.join(getUserRoomName(user.userId));
      await client.join(getSessionRoomName(user.sessionId));

      this.logger.debug(`WebSocket authenticated for user: ${user.userId}`);

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "TokenExpiredError") {
        client.emit(AUTH_SOCKET_EVENTS.SESSION_EXPIRED);
      }
      client.disconnect(true);
      if (error instanceof WsException) throw error;

      this.logger.debug(`WebSocket authentication failed: ${error}`);
      throw new WsException("Unauthorized: Invalid token");
    }
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
