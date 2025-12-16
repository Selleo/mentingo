import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const wsUrl = `${apiUrl.replace(/^http/, "ws")}/ws`;

    socket = io(wsUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
