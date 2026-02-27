import { Injectable } from "@nestjs/common";

import { WsGateway } from "src/websocket/websocket.gateway";

import type { RealtimePublisher } from "src/websocket/realtime.publisher";

@Injectable()
export class SocketRealtimePublisher implements RealtimePublisher {
  constructor(private readonly wsGateway: WsGateway) {}

  emitToRoom(event: string, roomId: string, payload: unknown): void {
    this.wsGateway.emitToRoom(roomId, event, payload);
  }

  emitToRoomWithAck<T = unknown>(
    event: string,
    roomId: string,
    payload: unknown,
    timeoutMs: number = 5000,
  ): Promise<T[]> {
    return this.wsGateway.server.to(roomId).timeout(timeoutMs).emitWithAck(event, payload);
  }
}
