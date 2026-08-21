import { describe, expect, it } from "vitest";

import { RealtimePCMStreamerWorklet, type StreamProtocol } from "./audio-stream";

type FakeSocket = {
  connected: boolean;
  emitted: Array<{ event: string; args: unknown[] }>;
  emit: (event: string, ...args: unknown[]) => void;
  on: () => void;
  off: () => void;
};

type StreamerInternals = {
  socket: FakeSocket;
  sessionRunId: string | null;
  nextAudioSeq: number;
  isRecovering: boolean;
  outboundOperations: Array<{ operation: () => void; seq?: number }>;
  sentChunks: Map<number, ArrayBuffer>;
  hasActiveSpeechSegment: boolean;
  isSpeaking: boolean;
  emitSpeechStartBoundary: () => void;
  completeActiveSpeechSegment: () => void;
  replayUnacknowledgedChunks: (expectedNextAudioSeq: number) => boolean;
  pumpOutbound: () => Promise<void>;
};

const protocol: StreamProtocol<unknown, unknown> = {
  buildStartEmit: () => ({ event: "start", args: [] }),
  buildChunkEmit: ({ chunkMeta }) => ({
    event: "chunk",
    args: [chunkMeta.seq],
  }),
  buildStopEmit: () => ({ event: "stop", args: [] }),
  buildCancelEmit: () => ({ event: "cancel", args: [] }),
  buildSpeechStartEmit: ({ boundary }) => ({
    event: "speech.start",
    args: [boundary],
  }),
  buildSpeechEndEmit: ({ boundary }) => ({
    event: "speech.end",
    args: [boundary],
  }),
};

const createStreamer = () => {
  const streamer = new RealtimePCMStreamerWorklet(protocol);
  const socket: FakeSocket = {
    connected: false,
    emitted: [],
    emit(event, ...args) {
      this.emitted.push({ event, args });
    },
    on: () => undefined,
    off: () => undefined,
  };
  const internals = streamer as unknown as StreamerInternals;
  internals.socket = socket;
  internals.sessionRunId = "run-1";
  return { internals, socket };
};

describe("RealtimePCMStreamerWorklet recovery", () => {
  it("buffers speech boundaries while disconnected and sends them through the pump", async () => {
    const { internals, socket } = createStreamer();

    internals.emitSpeechStartBoundary();

    expect(internals.outboundOperations).toHaveLength(1);
    expect(socket.emitted).toHaveLength(0);

    socket.connected = true;
    await internals.pumpOutbound();

    expect(socket.emitted).toEqual([
      {
        event: "speech.start",
        args: [
          {
            sessionRunId: "run-1",
            boundarySeq: 1,
            tsMs: expect.any(Number),
            lastAudioSeq: -1,
          },
        ],
      },
    ]);
  });

  it("replays buffered chunks through the same outbound queue", async () => {
    const { internals, socket } = createStreamer();
    socket.connected = true;
    internals.nextAudioSeq = 4;
    internals.sentChunks.set(1, new ArrayBuffer(1));
    internals.sentChunks.set(2, new ArrayBuffer(1));
    internals.sentChunks.set(3, new ArrayBuffer(1));

    expect(internals.replayUnacknowledgedChunks(2)).toBe(true);
    expect(internals.outboundOperations.map(({ seq }) => seq)).toEqual([2, 3]);

    socket.connected = true;
    await internals.pumpOutbound();

    expect(socket.emitted).toEqual([
      { event: "chunk", args: [2] },
      { event: "chunk", args: [3] },
    ]);
  });

  it("emits only one end boundary when completion is requested twice", async () => {
    const { internals, socket } = createStreamer();
    internals.hasActiveSpeechSegment = true;
    internals.isSpeaking = true;

    internals.completeActiveSpeechSegment();
    internals.completeActiveSpeechSegment();
    socket.connected = true;
    await internals.pumpOutbound();

    expect(socket.emitted.filter(({ event }) => event === "speech.end")).toHaveLength(1);
  });
});
