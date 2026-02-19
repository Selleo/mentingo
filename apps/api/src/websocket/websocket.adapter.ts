import { INestApplication } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

import { DB_ADMIN } from "src/storage/db/db.providers";
import { createCorsOriginOption } from "src/utils/cors";

import type { RedisClientType } from "redis";
import type { ServerOptions } from "socket.io";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: RedisClientType | null = null;
  private subClient: RedisClientType | null = null;
  private readonly appRef: INestApplication;

  constructor(
    app: INestApplication,
    private readonly redisUrl: string,
  ) {
    super(app);
    this.appRef = app;
  }

  async connectToRedis(): Promise<void> {
    this.pubClient = createClient({ url: this.redisUrl }) as RedisClientType;
    this.subClient = this.pubClient.duplicate() as RedisClientType;

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
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

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }

  async close(): Promise<void> {
    await this.pubClient?.quit();
    await this.subClient?.quit();
  }
}
