import { Injectable } from "@nestjs/common";
import { AUTH_SOCKET_EVENTS } from "@repo/shared";
import { chunk } from "lodash";

import { SessionRevocationService } from "src/redis";
import { WS_SESSION_REVALIDATION } from "src/websocket/websocket.constants";
import { WsGateway } from "src/websocket/websocket.gateway";

@Injectable()
export class SessionSocketsRevalidationService {
  constructor(
    private readonly wsGateway: WsGateway,
    private readonly sessionRevocationService: SessionRevocationService,
  ) {}

  /**
   * Disconnects this instance's sockets whose session is no longer active or whose permissions have
   * changed. It backs up the immediate disconnects on logout and on access changes, which are
   * best-effort broadcasts and can be lost. Sockets with outdated permissions are told to refresh
   * first, so the client can reconnect with its current permissions.
   */
  async disconnectRevokedSessionSockets(): Promise<void> {
    const sockets = await this.wsGateway.server.local.fetchSockets();
    const socketSessions = sockets.flatMap((socket) =>
      socket.data.user ? [{ socket, ...socket.data.user }] : [],
    );

    for (const batch of chunk(socketSessions, WS_SESSION_REVALIDATION.BATCH_SIZE)) {
      const { revoked, expired } =
        await this.sessionRevocationService.findInactiveAccessTokens(batch);

      expired.forEach(({ socket }) => socket.emit(AUTH_SOCKET_EVENTS.SESSION_EXPIRED));
      [...revoked, ...expired].forEach(({ socket }) => socket.disconnect(true));
    }
  }
}
