export const REALTIME_PUBLISHER = Symbol("REALTIME_PUBLISHER");

export interface RealtimePublisher {
  emitToAll(event: string, payload: unknown): void;
  emitToRoom(event: string, roomId: string, payload: unknown): void;
  emitToRoomWithAck<T = unknown>(
    event: string,
    roomId: string,
    payload: unknown,
    timeoutMs?: number,
  ): Promise<T[]>;
}
