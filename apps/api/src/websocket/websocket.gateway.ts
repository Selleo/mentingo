import { Logger, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server } from "socket.io";

import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import {
  AuthenticatedSocket,
  HeartbeatPayload,
  JoinLessonPayload,
  LeaveLessonPayload,
} from "src/websocket/websocket.types";

import type { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from "@nestjs/websockets";
import type { Socket } from "socket.io";

@WebSocketGateway({
  namespace: "/ws",
  path: "/api/ws",
  transports: ["websocket", "polling"],
})
export class WsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);

  private heartbeatHandlers: Array<
    (socket: AuthenticatedSocket, payload: HeartbeatPayload) => Promise<void>
  > = [];

  private joinLessonHandlers: Array<
    (socket: AuthenticatedSocket, payload: JoinLessonPayload) => Promise<void>
  > = [];

  private leaveLessonHandlers: Array<
    (socket: AuthenticatedSocket, payload: LeaveLessonPayload) => Promise<void>
  > = [];

  private disconnectHandlers: Array<(socket: AuthenticatedSocket) => Promise<void>> = [];

  afterInit() {
    this.logger.log("WebSocket Gateway initialized");
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client attempting connection: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const authenticatedClient = client as AuthenticatedSocket;
    const user = authenticatedClient.data?.user;

    if (user) {
      this.logger.debug(`Client disconnected: ${client.id}, userId: ${user.userId}`);

      for (const handler of this.disconnectHandlers) {
        try {
          await handler(authenticatedClient);
        } catch (error) {
          this.logger.error(`Disconnect handler error: ${error}`);
        }
      }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join:lesson")
  async handleJoinLesson(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinLessonPayload,
  ) {
    const { lessonId } = payload;
    const userId = client.data.user.userId;

    const roomName = `lesson:${lessonId}`;
    await client.join(roomName);

    this.logger.debug(`User ${userId} joined lesson room: ${roomName}`);

    for (const handler of this.joinLessonHandlers) {
      try {
        await handler(client, payload);
      } catch (error) {
        this.logger.error(`Join lesson handler error: ${error}`);
      }
    }

    return { success: true, room: roomName };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("leave:lesson")
  async handleLeaveLesson(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LeaveLessonPayload,
  ) {
    const { lessonId } = payload;
    const userId = client.data.user.userId;

    const roomName = `lesson:${lessonId}`;
    await client.leave(roomName);

    this.logger.debug(`User ${userId} left lesson room: ${roomName}`);

    for (const handler of this.leaveLessonHandlers) {
      try {
        await handler(client, payload);
      } catch (error) {
        this.logger.error(`Leave lesson handler error: ${error}`);
      }
    }

    return { success: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("heartbeat")
  async handleHeartbeat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: HeartbeatPayload,
  ) {
    for (const handler of this.heartbeatHandlers) {
      try {
        await handler(client, payload);
      } catch (error) {
        this.logger.error(`Heartbeat handler error: ${error}`);
      }
    }

    return { success: true };
  }

  onHeartbeat(handler: (socket: AuthenticatedSocket, payload: HeartbeatPayload) => Promise<void>) {
    this.heartbeatHandlers.push(handler);
  }

  onJoinLesson(
    handler: (socket: AuthenticatedSocket, payload: JoinLessonPayload) => Promise<void>,
  ) {
    this.joinLessonHandlers.push(handler);
  }

  onLeaveLesson(
    handler: (socket: AuthenticatedSocket, payload: LeaveLessonPayload) => Promise<void>,
  ) {
    this.leaveLessonHandlers.push(handler);
  }

  onDisconnect(handler: (socket: AuthenticatedSocket) => Promise<void>) {
    this.disconnectHandlers.push(handler);
  }

  emitToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
