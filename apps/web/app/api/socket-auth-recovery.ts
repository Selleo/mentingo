import { AUTH_SOCKET_EVENTS } from "@repo/shared";

import type { Socket } from "socket.io-client";

export function registerSocketAuthRecovery(
  socket: Socket,
  refreshSession: () => Promise<unknown>,
  isActive: () => boolean,
) {
  let disposed = false;
  let refreshing = false;

  const recover = async () => {
    if (disposed || refreshing || !isActive()) return;

    refreshing = true;
    try {
      await refreshSession();
      if (disposed || !isActive()) return;

      // A new handshake reads the refreshed httpOnly cookie.
      socket.disconnect().connect();
    } catch {
      // A failed refresh must leave the socket disconnected.
    } finally {
      refreshing = false;
    }
  };

  socket.on(AUTH_SOCKET_EVENTS.SESSION_EXPIRED, recover);
  return () => {
    disposed = true;
    socket.off(AUTH_SOCKET_EVENTS.SESSION_EXPIRED, recover);
  };
}
