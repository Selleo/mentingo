import { describe, expect, it } from "vitest";

import { RealtimePCMStreamerWorklet, type StreamProtocol } from "./audio-stream";
import { VOICE_CONNECTION_STATE, type VoiceConnectionState } from "./audio-stream.types";

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
  onRecoveryStarted: () => void;
  onRecovered: (payload: unknown) => void;
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

const createStreamer = (onRecoveryStateChange?: (state: VoiceConnectionState) => void) => {
  const streamer = new RealtimePCMStreamerWorklet(
    protocol,
    undefined,
    undefined,
    undefined,
    onRecoveryStateChange,
  );
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
  it("reports recovering and connected states around a successful recovery", () => {
    const states: VoiceConnectionState[] = [];
    const { internals, socket } = createStreamer((state) => states.push(state));
    socket.connected = true;

    internals.onRecoveryStarted();
    internals.onRecovered({ sessionRunId: "run-1", nextAudioSeq: 1 });

    expect(states).toEqual([VOICE_CONNECTION_STATE.RECOVERING, VOICE_CONNECTION_STATE.CONNECTED]);
  });

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
