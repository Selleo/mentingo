import { EventEmitter } from "node:events";

import { VOICE_SOCKET_EVENT } from "@repo/shared";
import { from, isObservable } from "rxjs";

import { OrderedVoiceIoAdapter } from "./ordered-voice-io.adapter";

import type { IoAdapter } from "@nestjs/platform-socket.io";
import type { MessageMappingProperties } from "@nestjs/websockets";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred() {
  let resolve: () => void = () => {
    throw new Error("Deferred not initialized");
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(handlers: Omit<MessageMappingProperties, "methodName">[]) {
  const incoming = new EventEmitter();
  const socket = {
    id: "synthetic-voice-socket",
    connected: true,
    on: incoming.on.bind(incoming),
    once: incoming.once.bind(incoming),
    off: incoming.off.bind(incoming),
    emit: jest.fn(),
    disconnect: jest.fn(() => {
      socket.connected = false;
      incoming.emit("disconnect");
    }),
  };
  const adapter = new OrderedVoiceIoAdapter();
  const transform: Parameters<IoAdapter["bindMessageHandlers"]>[2] = (result) =>
    isObservable(result) ? result : from(Promise.resolve(result));
  adapter.bindMessageHandlers(
    socket as unknown as Parameters<IoAdapter["bindMessageHandlers"]>[0],
    handlers.map((handler) => ({ ...handler, methodName: handler.message })),
    transform,
  );
  return { incoming, socket };
}

describe("Voice ingress ordering before asynchronous guards", () => {
  it("serializes the full asynchronous callback across chunks and speech boundaries", async () => {
    const blocked = deferred();
    const entered: string[] = [];
    const delivered: string[] = [];
    const handlers = [VOICE_SOCKET_EVENT.AUDIO_CHUNK, VOICE_SOCKET_EVENT.CLIENT_SPEECH_END].map(
      (message) => ({
        message,
        callback: async (data: string) => {
          entered.push(data);
          if (data === "chunk-1") await blocked.promise;
          delivered.push(data);
        },
      }),
    );
    const { incoming } = fixture(handlers);
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, "chunk-1");
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, "chunk-2");
    incoming.emit(VOICE_SOCKET_EVENT.CLIENT_SPEECH_END, "end");
    await tick();
    expect(entered).toEqual(["chunk-1"]);
    blocked.resolve();
    await tick();
    expect(delivered).toEqual(["chunk-1", "chunk-2", "end"]);
  });

  it("keeps independent sockets and unrelated incoming/outgoing events responsive", async () => {
    const blocked = deferred();
    const voice = jest.fn(() => blocked.promise);
    const unrelated = jest.fn(async () => ({ event: "ordinary-reply", data: "ok" }));
    const first = fixture([
      { message: VOICE_SOCKET_EVENT.AUDIO_CHUNK, callback: voice },
      { message: "ordinary", callback: unrelated },
    ]);
    const secondVoice = jest.fn(async () => true);
    const second = fixture([{ message: VOICE_SOCKET_EVENT.AUDIO_CHUNK, callback: secondVoice }]);
    first.incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, {});
    first.incoming.emit("ordinary", {});
    first.socket.emit(VOICE_SOCKET_EVENT.AUDIO_SPEECH, { seq: 1 });
    second.incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, {});
    await tick();
    expect(unrelated).toHaveBeenCalledTimes(1);
    expect(secondVoice).toHaveBeenCalledTimes(1);
    expect(first.socket.emit).toHaveBeenCalledWith("ordinary-reply", "ok");
    expect(first.socket.emit).toHaveBeenCalledWith(VOICE_SOCKET_EVENT.AUDIO_SPEECH, { seq: 1 });
    blocked.resolve();
    await tick();
  });

  it("drops queued work on disconnect without invoking its guards or handlers", async () => {
    const blocked = deferred();
    const callback = jest.fn(() => blocked.promise);
    const { incoming, socket } = fixture([{ message: VOICE_SOCKET_EVENT.AUDIO_CHUNK, callback }]);
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, 1);
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, 2);
    socket.disconnect();
    blocked.resolve();
    await tick();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels unsent work, ignores trailing old PCM, and permits an explicit new start", async () => {
    const blocked = deferred();
    const delivered: string[] = [];
    const handlers = [
      VOICE_SOCKET_EVENT.START_AUDIO,
      VOICE_SOCKET_EVENT.AUDIO_CHUNK,
      VOICE_SOCKET_EVENT.CANCEL_AUDIO,
    ].map((message) => ({
      message,
      callback: async (data: string) => {
        if (data === "in-flight") await blocked.promise;
        delivered.push(data);
      },
    }));
    const { incoming } = fixture(handlers);
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, "in-flight");
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, "discarded");
    incoming.emit(VOICE_SOCKET_EVENT.CANCEL_AUDIO, "cancel");
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, "trailing-old");
    incoming.emit(VOICE_SOCKET_EVENT.START_AUDIO, "new-start");
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, "new-chunk");
    blocked.resolve();
    await tick();
    expect(delivered).toEqual(["in-flight", "cancel", "new-start", "new-chunk"]);
  });

  it("drains accepted PCM before graceful stop and sequences recovery before new frames", async () => {
    const blocked = deferred();
    const delivered: string[] = [];
    const handlers = [
      VOICE_SOCKET_EVENT.AUDIO_CHUNK,
      VOICE_SOCKET_EVENT.STOP_AUDIO,
      VOICE_SOCKET_EVENT.AUDIO_RECONNECT,
    ].map((message) => ({
      message,
      callback: async (data: string) => {
        if (data === "chunk") await blocked.promise;
        delivered.push(data);
      },
    }));
    const { incoming } = fixture(handlers);
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, "chunk");
    incoming.emit(VOICE_SOCKET_EVENT.STOP_AUDIO, "stop");
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, "trailing-old");
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_RECONNECT, "recover");
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, "replay");
    blocked.resolve();
    await tick();
    expect(delivered).toEqual(["chunk", "stop", "recover", "replay"]);
  });

  it.each(["messages", "bytes", "metadata"])(
    "fails explicitly on excessive buffered %s",
    async (limit) => {
      const blocked = deferred();
      const callback = jest.fn(() => blocked.promise);
      const { incoming, socket } = fixture([{ message: VOICE_SOCKET_EVENT.AUDIO_CHUNK, callback }]);
      incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, { bytes: Buffer.alloc(640) });
      const count = limit === "messages" ? 129 : 3;
      const bytes = limit === "messages" ? Buffer.alloc(640) : Buffer.alloc(1024 * 1024);
      for (let index = 0; index < count; index++)
        incoming.emit(
          VOICE_SOCKET_EVENT.AUDIO_CHUNK,
          limit === "metadata" ? { text: "x".repeat(1024 * 1024) } : { bytes },
        );
      expect(socket.emit).toHaveBeenCalledWith(VOICE_SOCKET_EVENT.AUDIO_RECONNECT_ERROR, {
        code: "AUDIO_INGRESS_QUEUE_OVERFLOW",
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      blocked.resolve();
      await tick();
      expect(callback).toHaveBeenCalledTimes(1);
    },
  );

  it("does not dispatch later frames after an unexpected callback failure", async () => {
    const blocked = deferred();
    const callback = jest.fn(async () => {
      await blocked.promise;
      throw new Error("synthetic");
    });
    const { incoming, socket } = fixture([{ message: VOICE_SOCKET_EVENT.AUDIO_CHUNK, callback }]);
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, 1);
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, 2);
    blocked.resolve();
    await tick();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("fails closed when an authentication/handler operation stalls", async () => {
    jest.useFakeTimers();
    const blocked = deferred();
    try {
      const callback = jest.fn(() => blocked.promise);
      const { incoming, socket } = fixture([{ message: VOICE_SOCKET_EVENT.AUDIO_CHUNK, callback }]);
      incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, 1);
      incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, 2);
      await jest.advanceTimersByTimeAsync(5_001);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      blocked.resolve();
      await Promise.resolve();
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      blocked.resolve();
      jest.useRealTimers();
    }
  });

  it("preserves Socket.IO acknowledgments and multiple event responses", async () => {
    const ack = jest.fn();
    const { incoming, socket } = fixture([
      { message: VOICE_SOCKET_EVENT.START_AUDIO, callback: async () => ({ ok: true }) },
      {
        message: VOICE_SOCKET_EVENT.AUDIO_CHUNK,
        callback: () =>
          from([
            { event: "first", data: 1 },
            { event: "second", data: 2 },
          ]),
      },
    ]);
    incoming.emit(VOICE_SOCKET_EVENT.START_AUDIO, { synthetic: true }, ack);
    incoming.emit(VOICE_SOCKET_EVENT.AUDIO_CHUNK, {});
    await tick();
    expect(ack).toHaveBeenCalledWith({ ok: true });
    expect(socket.emit).toHaveBeenCalledWith("first", 1);
    expect(socket.emit).toHaveBeenCalledWith("second", 2);
  });
});
