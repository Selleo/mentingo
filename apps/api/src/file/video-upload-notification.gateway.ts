import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { createClient as createRedisClient } from "redis";
import { Server } from "socket.io";

import { buildRedisConnection , RedisConfigSchema } from "src/common/configuration/redis";

import type { OnModuleDestroy } from "@nestjs/common";
import type {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect} from "@nestjs/websockets";
import type { RedisClientType } from "redis";
import type { Socket } from "socket.io";

export type VideoUploadNotification = {
  uploadId: string;
  status: "uploaded" | "processed" | "failed";
  fileKey?: string;
  fileUrl?: string;
  error?: string;
};

@WebSocketGateway({
  cors: {
    origin: "*", // Configure this based on your frontend URL
    methods: ["GET", "POST"],
  },
  namespace: "/video-upload",
})
@Injectable()
export class VideoUploadNotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private async setupRedisSubscriber() {
    try {
      const connection = buildRedisConnection(this.redisConfig);

      // Setup subscriber
      this.redisSubscriber = createRedisClient(connection);
      await this.redisSubscriber.connect();

      await this.redisSubscriber.subscribe(this.channel, (message) => {
        try {
          this.logger.log("Received Redis message:", message);
          const notification: VideoUploadNotification = JSON.parse(message);
          this.logger.log(`Broadcasting to WebSocket: ${notification.uploadId}, status: ${notification.status}`);
          this.server.emit("upload-status-change", notification);
          this.logger.log(`Broadcasted upload status change: ${notification.uploadId}, status: ${notification.status}`);
        } catch (error) {
          this.logger.error("Error parsing notification message:", error);
        }
      });

      // Setup shared publisher
      this.redisPublisher = createRedisClient(connection);
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
      this.logger.log(`Published notification: ${notification.uploadId}, status: ${notification.status}`);
    } catch (error) {
      this.logger.error("Failed to publish notification:", error);
    }
  }
}
