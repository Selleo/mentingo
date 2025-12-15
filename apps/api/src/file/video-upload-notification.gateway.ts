import { Inject, Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { createClient as createRedisClient } from "redis";
import { Server, Socket } from "socket.io";

import { buildRedisConnection, RedisConfigSchema } from "src/common/configuration/redis";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";

import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from "@nestjs/websockets";
import type { RedisClientType } from "redis";
import type { UUIDType } from "src/common";
import * as cookie from "cookie";

export type VideoUploadNotification = {
  uploadId: string;
  status: "uploaded" | "processed" | "failed";
  fileKey?: string;
  fileUrl?: string;
  error?: string;
  userId?: UUIDType;
};

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
  path: "/api/ws",
  namespace: "/ws",
  transports: ["websocket"],
})
@Injectable()
export class VideoUploadNotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VideoUploadNotificationGateway.name);
  private redisSubscriber: RedisClientType;
  private redisPublisher: RedisClientType;
  private readonly channel = "video-upload:notifications";

  constructor(
    @Inject("REDIS_CONFIG") private readonly redisConfig: RedisConfigSchema,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.setupRedisSubscriber();
  }

  async onModuleDestroy() {
    await this.redisSubscriber?.quit();
    await this.redisPublisher?.quit();
  }

  afterInit(_server: Server) {
    _server.use(async (client: Socket, next) => {
      const token = this.extractWsAccessToken(client);
      if (!token) return next(new Error("Access token not found"));

      client.data.user = await this.jwtService.verifyAsync(token);

      return next();
    });

    this.logger.log("Video upload notification gateway initialized");
  }

  handleConnection(client: Socket) {
    client.join(`user:${client.data.user.userId}`);

    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private extractWsAccessToken(client: Socket) {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return null;

    return cookie.parse(cookieHeader)["access_token"] ?? null;
  }

  private async setupRedisSubscriber() {
    try {
      const connection = buildRedisConnection(this.redisConfig);

      this.redisSubscriber = createRedisClient(connection);

      this.redisSubscriber.on("error", (e) => this.logger.error("Redis sub error:", e));

      await this.redisSubscriber.connect();

      await this.redisSubscriber.subscribe(this.channel, (message) => {
        try {
          this.logger.log("Received Redis message:", message);

          const notification: VideoUploadNotification = JSON.parse(message);

          this.logger.log(
            `Broadcasting to WebSocket: ${notification.uploadId}, status: ${notification.status}`,
          );

          this.server.to(`user:${notification.userId}`).emit("upload-status-change", notification);
          this.logger.log(
            `Broadcasted upload status change: ${notification.uploadId}, status: ${notification.status}`,
          );
        } catch (error) {
          this.logger.error("Error parsing notification message:", error);
        }
      });

      this.redisPublisher = createRedisClient(connection);

      this.redisPublisher.on("error", (e) => this.logger.error("Redis pub error:", e));

      await this.redisPublisher.connect();

      this.logger.log("Redis subscriber and publisher setup completed");
    } catch (error) {
      this.logger.error("Failed to setup Redis subscriber/publisher:", error);
    }
  }

  async publishNotification(notification: VideoUploadNotification) {
    try {
      if (!this.redisPublisher) {
        this.logger.error("Redis publisher not initialized");
        return;
      }

      await this.redisPublisher.publish(this.channel, JSON.stringify(notification));
      this.logger.log(
        `Published notification: ${notification.uploadId}, status: ${notification.status}`,
      );
    } catch (error) {
      this.logger.error("Failed to publish notification:", error);
    }
  }
}
