import { Injectable } from "@nestjs/common";
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
   * Disconnects this instance's sockets whose session is no longer active. It backs up the
   * immediate disconnect on logout, which is a best-effort broadcast and can be lost.
   */
  async disconnectRevokedSessionSockets(): Promise<void> {
    const sockets = await this.wsGateway.server.local.fetchSockets();
    const socketSessions = sockets.flatMap((socket) =>
      socket.data.user ? [{ socket, ...socket.data.user }] : [],
    );

    for (const batch of chunk(socketSessions, WS_SESSION_REVALIDATION.BATCH_SIZE)) {
      const revokedSessions = await this.sessionRevocationService.findInactiveSessions(batch);
      revokedSessions.forEach(({ socket }) => socket.disconnect(true));
    }
  }
}
