import { type CanActivate, type ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import { parse } from "cookie";

import type { AuthenticatedSocket, WsUser } from "src/websocket/websocket.types";

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();

    if (client.data?.user) {
      return true;
    }

    const token = this.extractToken(client);

    if (!token) {
      this.logger.debug("No token provided for WebSocket connection");
      throw new WsException("Unauthorized: No token provided");
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("jwt.secret"),
      });

      const user: WsUser = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
      };

      client.data = { ...client.data, user };

      await client.join(`user:${user.userId}`);

      this.logger.debug(`WebSocket authenticated for user: ${user.userId}`);

      return true;
    } catch (error) {
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
