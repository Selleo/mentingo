import { io, type Socket } from "socket.io-client";

import { baseUrl } from "~/utils/baseUrl";

import { ApiClient } from "./api-client";
import { registerSocketAuthRecovery } from "./socket-auth-recovery";

let socket: Socket | null = null;
let socketRefCount = 0;
let disposeAuthRecovery: (() => void) | null = null;
let tokenRefresh: Promise<unknown> | null = null;

const createSocket = (forceNew = false) => {
  const apiUrl = import.meta.env.VITE_API_URL ?? baseUrl;
  const wsUrl = `${apiUrl.replace(/^http/, "ws")}/ws`;
  return io(wsUrl, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: false,
    path: "/api/ws",
    forceNew,
  });
};

/** Reuse one token rotation when foreground and background handshakes both expire. */
const refreshSocketSession = () => {
  tokenRefresh ??= Promise.resolve(ApiClient.api.authControllerRefreshTokens()).finally(() => {
    tokenRefresh = null;
  });
  return tokenRefresh;
};

/** Keep the room lifecycle independent of subscribers on the shared socket. */
export function openIndependentSocket() {
  const connection = createSocket(true);
  let active = true;
  const disposeRecovery = registerSocketAuthRecovery(
    connection,
    refreshSocketSession,
    () => active,
  );
  return {
    socket: connection,
    dispose: () => {
      active = false;
      disposeRecovery();
      connection.disconnect();
    },
  };
}

export function getSocket(): Socket {
  if (!socket) {
    socket = createSocket();
    disposeAuthRecovery = registerSocketAuthRecovery(
      socket,
      refreshSocketSession,
      () => socketRefCount > 0,
    );
  }

  return socket;
}

export function acquireSocket(): Socket {
  socketRefCount += 1;
  return getSocket();
}

export function releaseSocket(): void {
  if (socketRefCount > 0) {
    socketRefCount -= 1;
  }

  if (socketRefCount === 0 && socket) {
    disposeAuthRecovery?.();
    disposeAuthRecovery = null;
    socket.disconnect();
    socket = null;
  }
}
