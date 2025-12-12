import { IoAdapter } from "@nestjs/platform-socket.io";

import type { ServerOptions } from "socket.io";

export class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: "*", // Configure this based on your frontend URL
        methods: ["GET", "POST"],
        credentials: true,
      },
    });
    return server;
  }
}
