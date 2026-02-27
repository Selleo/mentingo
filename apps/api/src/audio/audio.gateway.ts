import { Injectable, Logger, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { PcmChunkMeta, VOICE_SOCKET_EVENT } from "@repo/shared";
import { Server } from "socket.io";

import { AudioService } from "src/audio/audio.service";
import { StartAudioBody } from "src/audio/types/audio.types";
import { AuthenticatedSocket, WsJwtGuard } from "src/websocket";

import type { RealtimePublisher } from "src/websocket/realtime.publisher";

@WebSocketGateway({
  path: "/api/ws",
  namespace: "/ws",
  transports: ["websocket"],
})
@Injectable()
export class AudioGateway implements OnGatewayInit, RealtimePublisher {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AudioGateway.name);

  afterInit(_server: Server) {
    this.logger.log("AudioGateway initialized");
  }

  emitToRoom(event: string, roomId: string, payload: unknown) {
    this.server.to(roomId).emit(event, payload);
  }

  emitToRoomWithAck<T = unknown>(
    event: string,
    roomId: string,
    payload: unknown,
    timeoutMs: number = 5000,
  ): Promise<T[]> {
    return this.server.to(roomId).timeout(timeoutMs).emitWithAck(event, payload);
  }

  constructor(private readonly audioService: AudioService) {}

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(VOICE_SOCKET_EVENT.START_AUDIO)
  async startAudio(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: StartAudioBody,
  ) {
    await this.audioService.startAudio(client.id, payload);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(VOICE_SOCKET_EVENT.AUDIO_CHUNK)
  async audioChunk(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody("meta") meta: PcmChunkMeta,
    @MessageBody("bytes") bytes: Buffer,
  ) {
    await this.audioService.audioChunk(client.id, meta, bytes);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(VOICE_SOCKET_EVENT.STOP_AUDIO)
  async stopAudio(@ConnectedSocket() client: AuthenticatedSocket) {
    return await this.audioService.stopAudio(client.id);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(VOICE_SOCKET_EVENT.CANCEL_AUDIO)
  async cancelAudio(@ConnectedSocket() client: AuthenticatedSocket) {
    return await this.audioService.cancelAudio(client.id);
  }
}
