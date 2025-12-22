import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Always connect through the same origin to ensure cookies are sent
    // The Caddy proxy at /socket.io/* forwards to the backend
    const wsOrigin = typeof window !== "undefined" ? window.location.origin : "";

    socket = io(`${wsOrigin}/ws`, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
    });

    // Add connection debugging
    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
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
