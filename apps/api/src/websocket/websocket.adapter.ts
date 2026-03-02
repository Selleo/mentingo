import { INestApplication } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

import { RedisClient } from "src/redis";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { createCorsOriginOption } from "src/utils/cors";

import type { ServerOptions } from "socket.io";

export class RedisIoAdapter extends IoAdapter {
  private readonly adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly appRef: INestApplication;

  constructor(app: INestApplication, pubClient: RedisClient, subClient: RedisClient) {
    super(app);
    this.appRef = app;
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const dbBase = this.appRef.get(DB_ADMIN);

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: createCorsOriginOption(dbBase),
        credentials: true,
      },
    });

    server.adapter(this.adapterConstructor);

    return server;
  }
}
