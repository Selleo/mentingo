import { Inject, Injectable, Logger, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { createClient as createRedisClient } from "redis";
import { Server } from "socket.io";

import { buildRedisConnection, RedisConfigSchema } from "src/common/configuration/redis";
import { getUserRoomKey } from "src/file/utils/userRoom";
import { AuthenticatedSocket, WsJwtGuard } from "src/websocket";

import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { OnGatewayInit } from "@nestjs/websockets";
import type { VideoUploadStatus } from "@repo/shared";
import type { RedisClientType } from "redis";
import type { UUIDType } from "src/common";

export type VideoUploadNotification = {
  uploadId: string;
  status: VideoUploadStatus;
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
  implements OnGatewayInit, OnModuleDestroy, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VideoUploadNotificationGateway.name);
  private redisSubscriber: RedisClientType;
  private redisPublisher: RedisClientType;
  private readonly channel = "video-upload:notifications";

  constructor(@Inject("REDIS_CONFIG") private readonly redisConfig: RedisConfigSchema) {}

  async onModuleInit() {
    await this.setupRedisSubscriber();
  }

  async onModuleDestroy() {
    await this.redisSubscriber?.quit();
    await this.redisPublisher?.quit();
  }

  afterInit(_server: Server) {
    this.logger.log("Video upload notification gateway initialized");
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join:user")
  async handleJoinUser(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.data.user.userId;

    this.logger.debug(`Client joined room ${getUserRoomKey(userId)}`);

    client.join(getUserRoomKey(userId));
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("leave:user")
  async handleLeaveUser(@ConnectedSocket() client: AuthenticatedSocket) {
    const userId = client.data.user.userId;

    this.logger.debug(`Client joined room ${getUserRoomKey(userId)}`);

    client.leave(getUserRoomKey(userId));
  }

  private async setupRedisSubscriber() {
    try {
      const connection = buildRedisConnection(this.redisConfig);

      this.redisSubscriber = createRedisClient(connection);

      this.redisPublisher = createRedisClient(connection);

      await Promise.all([this.redisSubscriber.connect(), this.redisPublisher.connect()]);

      await this.redisSubscriber.subscribe(this.channel, (message) => {
        const notification = this.safeParseNotification(message);
        if (!notification?.userId) {
          this.logger.warn("Ignoring upload notification without userId");
          return;
        }

        this.logger.debug(
          `Broadcasting to WebSocket: ${notification.uploadId}, status: ${notification.status}`,
        );

        this.server
          .to(getUserRoomKey(notification.userId))
          .emit("upload-status-change", notification);

        this.logger.debug(
          `Broadcasted upload status change: ${notification.uploadId}, status: ${notification.status}`,
        );
      });

      this.logger.log("Redis subscriber and publisher setup completed");
    } catch (error) {
      this.logger.error("Failed to setup Redis subscriber/publisher:", error);
    }
  }

  private safeParseNotification(message: string): VideoUploadNotification | null {
    try {
      return JSON.parse(message) as VideoUploadNotification;
    } catch (error) {
      this.logger.error("Error parsing notification message:", error);
      return null;
    }
  }

  async publishNotification(notification: VideoUploadNotification) {
    try {
      if (!this.redisPublisher) {
        this.logger.error("Redis publisher not initialized");
        return;
      }

      await this.redisPublisher.publish(this.channel, JSON.stringify(notification));
      this.logger.debug(
        `Published notification: ${notification.uploadId}, status: ${notification.status}`,
      );
    } catch (error) {
      this.logger.error("Failed to publish notification:", error);
    }
  }
}
