import { INestApplication } from "@nestjs/common";
import { createAdapter } from "@socket.io/redis-adapter";

import { RedisClient } from "src/redis";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { createCorsOriginOption } from "src/utils/cors";

import { OrderedVoiceIoAdapter } from "./ordered-voice-io.adapter";

import type { ServerOptions } from "socket.io";

export class RedisIoAdapter extends OrderedVoiceIoAdapter {
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
