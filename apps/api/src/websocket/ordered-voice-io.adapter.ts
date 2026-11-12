import { Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { VOICE_SOCKET_EVENT } from "@repo/shared";
import { lastValueFrom, tap, timeout } from "rxjs";

import type { OrderedVoicePacket } from "./ordered-voice-io-adapter.types";
import type { MessageMappingProperties } from "@nestjs/websockets";

const ORDERED_VOICE_EVENTS = new Set<string>([
  VOICE_SOCKET_EVENT.START_AUDIO,
  VOICE_SOCKET_EVENT.AUDIO_CHUNK,
  VOICE_SOCKET_EVENT.CLIENT_SPEECH_START,
  VOICE_SOCKET_EVENT.CLIENT_SPEECH_END,
  VOICE_SOCKET_EVENT.AUDIO_RECONNECT,
  VOICE_SOCKET_EVENT.STOP_AUDIO,
  VOICE_SOCKET_EVENT.CANCEL_AUDIO,
  VOICE_SOCKET_EVENT.TRIGGER_TTS,
]);
const MAX_PENDING_MESSAGES = 128;
const MAX_PACKET_PROCESSING_MS = 5_000;
const MAX_BUFFERED_BYTES = 2 * 1024 * 1024;

/** Serialize voice ingress before Nest executes asynchronous guards, not just inside handlers. */
export class OrderedVoiceIoAdapter extends IoAdapter {
  private readonly logger = new Logger(OrderedVoiceIoAdapter.name);

  override bindMessageHandlers(
    socket: Parameters<IoAdapter["bindMessageHandlers"]>[0],
    handlers: MessageMappingProperties[],
    transform: Parameters<IoAdapter["bindMessageHandlers"]>[2],
  ): void {
    super.bindMessageHandlers(
      socket,
      handlers.filter(({ message }) => !ORDERED_VOICE_EVENTS.has(message)),
      transform,
    );
    const voiceHandlers = handlers.filter(({ message }) => ORDERED_VOICE_EVENTS.has(message));
    if (!voiceHandlers.length) return;

    const pending: OrderedVoicePacket[] = [];
    let bufferedBytes = 0;
    let running = false;
    let closed = false;
    let inputClosed = false;

    const clearPending = () => {
      for (const packet of pending.splice(0)) bufferedBytes -= packet.bytes;
    };
    const listeners: Array<{ message: string; listener: (...args: unknown[]) => void }> = [];
    const close = () => {
      closed = true;
      clearPending();
      for (const { message, listener } of listeners) socket.off(message, listener);
    };
    socket.once("disconnect", close);

    const fail = (code: string) => {
      if (closed) return;
      close();
      this.logger.warn(`Voice ingress terminated socket=${socket.id} code=${code}`);
      socket.emit(VOICE_SOCKET_EVENT.AUDIO_RECONNECT_ERROR, { code });
      socket.disconnect(true);
    };

    const drain = async () => {
      if (running || closed) return;
      running = true;
      try {
        while (!closed && socket.connected && pending.length) {
          const packet = pending.shift();
          if (!packet) break;
          try {
            const remainingMs = MAX_PACKET_PROCESSING_MS - (Date.now() - packet.receivedAt);
            if (remainingMs <= 0) {
              fail("AUDIO_INGRESS_QUEUE_TIMEOUT");
              break;
            }
            const { data, ack } = this.mapPayload(packet.payload);
            // Calling the Nest callback here includes guard, interceptor and handler completion.
            await lastValueFrom(
              transform(packet.handler.callback(data, ack)).pipe(
                timeout({ first: remainingMs, each: remainingMs }),
                tap((response: unknown) => {
                  if (closed || !socket.connected || response === null || response === undefined)
                    return;
                  if (
                    typeof response === "object" &&
                    "event" in response &&
                    typeof response.event === "string" &&
                    "data" in response
                  ) {
                    socket.emit(response.event, response.data);
                  } else if (typeof ack === "function") {
                    ack(response);
                  }
                }),
              ),
              { defaultValue: undefined },
            );
          } finally {
            bufferedBytes -= packet.bytes;
          }
        }
      } catch {
        // Never continue past a failed frame and manufacture a sequence gap downstream.
        fail("AUDIO_INGRESS_PROCESSING_FAILED");
      } finally {
        running = false;
      }
    };

    for (const handler of voiceHandlers) {
      const listener = (...args: unknown[]) => {
        if (closed || !socket.connected) return;
        const payload = args.length === 1 ? args[0] : args;
        if (handler.message === VOICE_SOCKET_EVENT.CANCEL_AUDIO) {
          // Cancellation intentionally discards unsent voice work, but still authenticates itself.
          clearPending();
          inputClosed = true;
        } else if (handler.message === VOICE_SOCKET_EVENT.STOP_AUDIO) {
          inputClosed = true;
        } else if (
          handler.message === VOICE_SOCKET_EVENT.START_AUDIO ||
          handler.message === VOICE_SOCKET_EVENT.AUDIO_RECONNECT
        ) {
          inputClosed = false;
        } else if (inputClosed) {
          return;
        }
        const bytes = packetByteLength(payload);
        if (pending.length >= MAX_PENDING_MESSAGES || bufferedBytes + bytes > MAX_BUFFERED_BYTES) {
          fail("AUDIO_INGRESS_QUEUE_OVERFLOW");
          return;
        }
        bufferedBytes += bytes;
        pending.push({ handler, payload, bytes, receivedAt: Date.now() });
        void drain();
      };
      listeners.push({ message: handler.message, listener });
      socket.on(handler.message, listener);
    }
  }
}

/** Bound retained metadata as well as binary PCM without serializing audio buffers. */
function packetByteLength(payload: unknown): number {
  const pending: unknown[] = [payload];
  const seen = new WeakSet<object>();
  let bytes = 0;
  let nodes = 0;
  while (pending.length) {
    const value = pending.pop();
    if (++nodes > 16_384) return MAX_BUFFERED_BYTES + 1;
    if (typeof value === "string") bytes += Buffer.byteLength(value);
    else if (value instanceof Uint8Array) bytes += value.byteLength;
    else if (typeof value === "number" || typeof value === "boolean") bytes += 8;
    else if (typeof value === "object" && value !== null && !seen.has(value)) {
      seen.add(value);
      const entries = Object.entries(value);
      if (entries.length + pending.length + nodes > 16_384) return MAX_BUFFERED_BYTES + 1;
      for (const [key, item] of entries) {
        bytes += Buffer.byteLength(key);
        pending.push(item);
      }
    }
    if (bytes > MAX_BUFFERED_BYTES) return bytes;
  }
  return bytes;
}
