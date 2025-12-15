import { IoAdapter } from "@nestjs/platform-socket.io";

import type { ServerOptions } from "socket.io";

export class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });
    return server;
  }
}
