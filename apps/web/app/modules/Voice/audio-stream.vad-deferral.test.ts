import { VOICE_ENDPOINTING_MODE, type VoiceEndpointingMode } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RealtimePCMStreamerWorklet, type StreamProtocol } from "./audio-stream";

type VadCallbacks = {
  preSpeechPadMs: number;
  redemptionMs: number;
  onFrameProcessed: (probabilities: { isSpeech: number }, frame: Float32Array) => void;
  onSpeechRealStart: () => void;
  onSpeechEnd: () => void;
  onVADMisfire: () => void;
};

const vadHarness = vi.hoisted(() => ({ callbacks: [] as VadCallbacks[] }));

vi.mock("@ricky0123/vad-web", () => ({
  MicVAD: {
    new: vi.fn(async (callbacks: VadCallbacks) => {
      vadHarness.callbacks.push(callbacks);
      return {
        start: vi.fn(async () => undefined),
        pause: vi.fn(async () => undefined),
        destroy: vi.fn(async () => undefined),
      };
    }),
  },
}));

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
  isSessionActive: boolean;
  captureGeneration: number;
  endpointingMode: VoiceEndpointingMode;
  keepClientVadTurnOpen: boolean;
  hasActiveSpeechSegment: boolean;
  pendingSamples: number[];
  outboundOperations: Array<{ operation: () => void; seq?: number }>;
  micVad: unknown | null;
  ensureMicVad: () => Promise<void>;
  onSessionMetadataCleared: () => void;
  onSocketConnect: () => void;
  onRecovered: (payload: unknown) => void;
  completeActiveSpeechSegment: () => void;
  pumpOutbound: () => Promise<void>;
};

const protocol: StreamProtocol<unknown, unknown> = {
  buildStartEmit: () => ({ event: "start", args: [] }),
  buildChunkEmit: ({ chunkMeta }) => ({ event: "chunk", args: [chunkMeta] }),
  buildStopEmit: () => ({ event: "stop", args: [] }),
  buildCancelEmit: () => ({ event: "cancel", args: [] }),
  buildSpeechStartEmit: ({ boundary }) => ({ event: "speech.start", args: [boundary] }),
  buildSpeechEndEmit: ({ boundary }) => ({ event: "speech.end", args: [boundary] }),
  buildReconnectEmit: ({ sessionRunId }) => ({ event: "reconnect", args: [sessionRunId] }),
};

const createHarness = async ({ keepClientVadTurnOpen = false } = {}) => {
  const streamer = new RealtimePCMStreamerWorklet(protocol);
  const internals = streamer as unknown as StreamerInternals;
  const socket: FakeSocket = {
    connected: false,
    emitted: [],
    emit(event, ...args) {
      this.emitted.push({ event, args });
    },
    on: () => undefined,
    off: () => undefined,
  };
  internals.socket = socket;
  internals.sessionRunId = "run-1";
  internals.isSessionActive = true;
  internals.captureGeneration = 1;
  internals.keepClientVadTurnOpen = keepClientVadTurnOpen;
  await internals.ensureMicVad();

  const callbacks = vadHarness.callbacks.at(-1);
  if (!callbacks) {
    throw new Error("VAD_CALLBACKS_NOT_CAPTURED");
  }

  return { callbacks, internals, socket, streamer };
};

const energeticFrame = () => new Float32Array(512).fill(0.03);
const silentFrame = () => new Float32Array(512).fill(0.001);

const emitSilenceWindow = (callbacks: VadCallbacks) => {
  for (let index = 0; index < 6; index += 1) {
    callbacks.onFrameProcessed({ isSpeech: 0 }, silentFrame());
  }
};

describe("RealtimePCMStreamerWorklet VAD end deferral", () => {
  beforeEach(() => {
    vadHarness.callbacks.length = 0;
  });

  it("forwards energetic filler once, drops low-energy frames, and emits one end boundary", async () => {
    const { callbacks, internals, socket } = await createHarness();

    callbacks.onSpeechRealStart();
    callbacks.onSpeechEnd();
    callbacks.onFrameProcessed({ isSpeech: 0 }, energeticFrame());
    emitSilenceWindow(callbacks);
    callbacks.onSpeechEnd();

    socket.connected = true;
    await internals.pumpOutbound();

    const chunks = socket.emitted.filter(({ event }) => event === "chunk");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.args[0]).toMatchObject({ samples: 512 });
    expect(socket.emitted.filter(({ event }) => event === "speech.end")).toHaveLength(1);
  });

  it("flushes the final real samples without appending silence", async () => {
    const { internals, socket } = await createHarness();
    internals.hasActiveSpeechSegment = true;
    internals.pendingSamples = [1, 2, 3];

    internals.completeActiveSpeechSegment();
    socket.connected = true;
    await internals.pumpOutbound();

    const chunk = socket.emitted.find(({ event }) => event === "chunk");
    expect(chunk?.args[0]).toMatchObject({ samples: 3 });
    expect(socket.emitted.filter(({ event }) => event === "speech.end")).toHaveLength(1);
  });

  it("turns an active-segment misfire into a deferred exact-once end", async () => {
    const { callbacks, internals, socket } = await createHarness();

    callbacks.onSpeechRealStart();
    callbacks.onVADMisfire();
    emitSilenceWindow(callbacks);
    callbacks.onVADMisfire();

    socket.connected = true;
    await internals.pumpOutbound();

    expect(socket.emitted.filter(({ event }) => event === "speech.end")).toHaveLength(1);
  });

  it("preserves a pending end across recovery and uses the recovered session run", async () => {
    const { callbacks, internals, socket } = await createHarness();

    callbacks.onSpeechRealStart();
    callbacks.onSpeechEnd();
    socket.connected = true;
    internals.onSocketConnect();
    emitSilenceWindow(callbacks);

    socket.connected = false;
    internals.onRecovered({ sessionRunId: "run-2" });
    socket.connected = true;
    await internals.pumpOutbound();

    const endEmission = socket.emitted.find(({ event }) => event === "speech.end");
    expect(endEmission?.args[0]).toMatchObject({ sessionRunId: "run-2" });
  });

  it("ignores callbacks from an older capture generation", async () => {
    const { callbacks, internals } = await createHarness();
    internals.captureGeneration = 2;
    internals.sessionRunId = "run-2";

    callbacks.onSpeechRealStart();
    callbacks.onFrameProcessed({ isSpeech: 1 }, energeticFrame());
    callbacks.onSpeechEnd();
    callbacks.onVADMisfire();

    expect(internals.hasActiveSpeechSegment).toBe(false);
    expect(internals.pendingSamples).toHaveLength(0);
    expect(internals.outboundOperations).toHaveLength(0);
  });

  it("recreates MicVAD after session metadata is cleared", async () => {
    const { callbacks: oldCallbacks, internals } = await createHarness();

    internals.onSessionMetadataCleared();
    expect(internals.micVad).toBeNull();
    oldCallbacks.onSpeechRealStart();
    expect(internals.hasActiveSpeechSegment).toBe(false);

    internals.captureGeneration += 1;
    internals.isSessionActive = true;
    internals.sessionRunId = "run-2";
    await internals.ensureMicVad();
    const newCallbacks = vadHarness.callbacks.at(-1);
    newCallbacks?.onSpeechRealStart();

    expect(vadHarness.callbacks).toHaveLength(2);
    expect(internals.hasActiveSpeechSegment).toBe(true);
  });

  it("rejects a second start while the current session is active", async () => {
    const { streamer } = await createHarness();

    await expect(streamer.start({})).rejects.toThrow("AUDIO_SESSION_ALREADY_ACTIVE");
  });

  it("uses VAD as boundaries while forwarding every real frame in an open learner turn", async () => {
    const { callbacks, internals, socket, streamer } = await createHarness({
      keepClientVadTurnOpen: true,
    });
    internals.endpointingMode = VOICE_ENDPOINTING_MODE.CLIENT_VAD;

    expect(callbacks.redemptionMs).toBe(300);
    expect(callbacks.preSpeechPadMs).toBe(500);

    callbacks.onFrameProcessed({ isSpeech: 0 }, silentFrame());
    callbacks.onSpeechRealStart();
    callbacks.onSpeechEnd();
    callbacks.onFrameProcessed({ isSpeech: 0 }, silentFrame());
    callbacks.onSpeechRealStart();

    socket.connected = true;
    await internals.pumpOutbound();

    expect(socket.emitted.filter(({ event }) => event === "chunk")).toHaveLength(2);
    expect(socket.emitted.filter(({ event }) => event === "speech.start")).toHaveLength(2);
    expect(socket.emitted.filter(({ event }) => event === "speech.end")).toHaveLength(1);

    streamer.closeLearnerTurn();
    callbacks.onFrameProcessed({ isSpeech: 0 }, silentFrame());
    expect(internals.hasActiveSpeechSegment).toBe(false);
    expect(internals.pendingSamples).toHaveLength(0);
  });

  it("retains VAD redemption for finite dictation segments", async () => {
    const { callbacks } = await createHarness();

    expect(callbacks.redemptionMs).toBe(700);
  });
});
