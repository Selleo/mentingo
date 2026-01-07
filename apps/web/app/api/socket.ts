import { io, type Socket } from "socket.io-client";

import { baseUrl } from "~/utils/baseUrl";

let socket: Socket | null = null;
let socketRefCount = 0;

export function getSocket(): Socket {
  if (!socket) {
    const apiUrl = import.meta.env.VITE_API_URL ?? baseUrl;
    const wsUrl = `${apiUrl.replace(/^http/, "ws")}/ws`;

    socket = io(wsUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
      path: "/api/ws",
    });
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
    socket.disconnect();
    socket = null;
  }
}
