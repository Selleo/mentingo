import {
  createLumaSocket,
  LUMA_CAPTURE_PROFILES,
  LUMA_MENTOR_STREAM_EVENT_TYPES,
  LUMA_SOCKET_MESSAGE_TYPES,
  TRANSCRIPTION_MODES,
} from "@japro/luma-sdk";
import { PERMISSIONS, SUPPORTED_LANGUAGES, VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";

import { ExternalAudioSessionStore } from "src/audio/external-audio-session.store";
import { ExternalAudioService } from "src/audio/external-audio.service";

import type {
  AudioChunkedPayload,
  AudioProtocolErrorPayload,
  AudioRecoveryPayload,
  AudioOutputInterruptedPayload,
  AudioStartedPayload,
  LumaSocket,
} from "@japro/luma-sdk";
import type { StartAudioBody } from "src/audio/types/audio.types";
import type { ExternalAudioSession } from "src/audio/types/external-audio-session.types";
import type { WsUser } from "src/websocket/websocket.types";

jest.mock("@japro/luma-sdk", () => ({
  ...jest.requireActual("@japro/luma-sdk"),
  createLumaSocket: jest.fn(),
}));

type RecoveryHandlers = {
  connect: () => void;
  disconnect: () => void;
  audioStarted: (payload: AudioStartedPayload) => void;
  audioChunked: (payload: AudioChunkedPayload) => void;
  audioChunkError: (payload: AudioProtocolErrorPayload) => void;
  audioRecovered: (payload: AudioRecoveryPayload) => void;
  audioReconnectError: (payload: AudioProtocolErrorPayload) => void;
  audioOutputInterrupted: (payload: AudioOutputInterruptedPayload) => void;
};

const currentUser: WsUser = {
  userId: "user-1",
  email: "learner@example.com",
  roleSlugs: [],
  permissions: [PERMISSIONS.COURSE_UPDATE],
  tenantId: "tenant-1",
};

const startPayload: StartAudioBody = {
  voiceAction: VOICE_ACTION.VOICE_MENTOR,
  lessonId: "00000000-0000-4000-8000-000000000001",
  meta: {
    sr: 16_000,
    channels: 1,
    format: "pcm_s16le",
  },
};

function createAudioStartedPayload(): AudioStartedPayload {
  return {
    type: LUMA_SOCKET_MESSAGE_TYPES.AUDIO_START,
    sessionId: "session-1",
    sessionRunId: "run-1",
    audioAction: "VOICE_MENTOR",
    meta: startPayload.meta,
    currentSocketUser: {
      userId: currentUser.userId,
      lessonId: startPayload.lessonId ?? "",
    },
    transcriptionSessionPlan: {
      effectiveTranscriptionMode: TRANSCRIPTION_MODES.REALTIME_STREAM,
      captureProfile: LUMA_CAPTURE_PROFILES.VAD_SEGMENTED,
      endpointOwner: "provider",
      interruptionMarker: "speech_start",
      supportsSpeechEvents: true,
      providerAdapter: "test",
      boundarySource: "client",
      supportsPartialTranscripts: true,
      supportsWordTimestamps: true,
      supportsSessionRecovery: true,
    },
    lastAcceptedAudioSeq: 0,
    nextAudioSeq: 1,
  };
}

function createRecoveryPayload(): AudioRecoveryPayload {
  return {
    type: LUMA_SOCKET_MESSAGE_TYPES.AUDIO_RECOVERED,
    sessionId: "session-1",
    sessionRunId: "run-1",
    state: "listening",
    providerState: "connected",
    lastAcceptedAudioSeq: 1,
    nextAudioSeq: 2,
    clientLastSentAudioSeq: 1,
    attempt: 1,
    transcriptionSessionPlan: createAudioStartedPayload().transcriptionSessionPlan,
  };
}

describe("ExternalAudioService recovery", () => {
  const originalLumaBaseUrl = process.env.LUMA_BASE_URL;

  beforeEach(() => {
    process.env.LUMA_BASE_URL = "http://luma.test";
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (originalLumaBaseUrl) {
      process.env.LUMA_BASE_URL = originalLumaBaseUrl;
      return;
    }

    delete process.env.LUMA_BASE_URL;
  });

  it("pauses chunks during an upstream disconnect and replays from Luma's cursor", async () => {
    const handlers = {} as RecoveryHandlers;
    const socket = {
      connected: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
      startAudio: jest.fn(),
      sendAudioChunk: jest.fn(),
      sendClientSpeechStart: jest.fn(),
      sendClientSpeechEnd: jest.fn(),
      reconnectAudio: jest.fn(),
      on: jest.fn((event: string, handler: () => void) => {
        if (event === "connect" || event === "disconnect") {
          handlers[event] = handler;
        }
      }),
      onAudioStarted: jest.fn((handler: RecoveryHandlers["audioStarted"]) => {
        handlers.audioStarted = handler;
      }),
      onAudioChunked: jest.fn((handler: RecoveryHandlers["audioChunked"]) => {
        handlers.audioChunked = handler;
      }),
      onAudioChunkError: jest.fn((handler: RecoveryHandlers["audioChunkError"]) => {
        handlers.audioChunkError = handler;
      }),
      onAudioRecovered: jest.fn((handler: RecoveryHandlers["audioRecovered"]) => {
        handlers.audioRecovered = handler;
      }),
      onAudioReconnectError: jest.fn((handler: RecoveryHandlers["audioReconnectError"]) => {
        handlers.audioReconnectError = handler;
      }),
      onLearnerTranscription: jest.fn(),
      onAudioOutputAlignment: jest.fn(),
      onAudioOutputChunk: jest.fn(),
      onAudioOutputInterrupted: jest.fn((handler: RecoveryHandlers["audioOutputInterrupted"]) => {
        handlers.audioOutputInterrupted = handler;
      }),
      onAudioOutputError: jest.fn(),
      onAudioOutputComplete: jest.fn(),
    };
    jest.mocked(createLumaSocket).mockReturnValue(socket as unknown as LumaSocket);

    const realtimePublisher = {
      emitToRoom: jest.fn(),
    };
    const sessionStore = new ExternalAudioSessionStore();
    const service = new ExternalAudioService(
      { getEnv: jest.fn().mockResolvedValue({ value: "api-key" }) } as never,
      { findAiMentorVoiceConfigByLessonId: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      {
        createThreadIfNoneExist: jest.fn().mockResolvedValue({
          thread: { id: "thread-1", userLanguage: SUPPORTED_LANGUAGES.EN },
        }),
      } as never,
      {
        getBaseLanguage: jest.fn().mockResolvedValue({ language: SUPPORTED_LANGUAGES.EN }),
      } as never,
      sessionStore,
      {} as never,
      realtimePublisher as never,
    );

    await service.startAudio("session-1", currentUser, startPayload);
    handlers.audioStarted(createAudioStartedPayload());

    const activeStreamAbortController = new AbortController();
    const session = sessionStore.get("session-1");
    if (!session) {
      throw new Error("Expected voice session to exist");
    }
    session.activeTurnId = "turn-1";
    session.activeMentorStream = {
      turnId: "turn-1",
      abortController: activeStreamAbortController,
    };

    handlers.audioOutputInterrupted({
      type: LUMA_MENTOR_STREAM_EVENT_TYPES.AUDIO_OUTPUT_INTERRUPTED,
      sessionId: "session-1",
      jobId: "interrupt-session-1-1",
      tsMs: 1,
      data: {
        reason: "USER_SPEECH",
        interruptedTurnId: null,
      },
    });

    expect(activeStreamAbortController.signal.aborted).toBe(true);
    expect(session.interruptedTurnIds).toContain("turn-1");
    expect(session.pendingInterruption).toBe(true);
    expect(session.activeTurnId).toBeNull();

    await service.audioChunk(
      "session-1",
      { seq: 1, sr: 16_000, samples: 512, ts_ms: 1 },
      Buffer.from([1]),
    );

    socket.connected = false;
    handlers.disconnect();
    await service.audioChunk(
      "session-1",
      { seq: 2, sr: 16_000, samples: 512, ts_ms: 2 },
      Buffer.from([2]),
    );

    expect(socket.sendAudioChunk).toHaveBeenCalledTimes(1);
    expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
      VOICE_SOCKET_EVENT.AUDIO_RECOVERY_STARTED,
      "session-1",
      { attempt: 1 },
    );

    socket.connected = true;
    handlers.connect();
    expect(socket.reconnectAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionRunId: "run-1",
        lastSentAudioSeq: 1,
        attempt: 1,
      }),
    );

    handlers.audioRecovered(createRecoveryPayload());

    expect(socket.sendAudioChunk).toHaveBeenLastCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ seq: 2 }) }),
      Buffer.from([2]),
    );
    expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
      VOICE_SOCKET_EVENT.AUDIO_RECOVERED,
      "session-1",
      expect.objectContaining({ nextAudioSeq: 2 }),
    );

    expect(service.handleClientDisconnect("session-1")).toBe(true);
    expect(
      service.reconnectAudio("session-2", currentUser, {
        type: LUMA_SOCKET_MESSAGE_TYPES.AUDIO_RECONNECT,
        sessionRunId: "run-1",
        lastSentAudioSeq: 2,
        attempt: 1,
      }),
    ).toBe(true);
    expect(sessionStore.get("session-1")).toBeUndefined();
    expect(sessionStore.get("session-2")).toBeDefined();

    handlers.audioRecovered(createRecoveryPayload());
    expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
      VOICE_SOCKET_EVENT.AUDIO_RECOVERED,
      "session-2",
      expect.objectContaining({ sessionRunId: "run-1" }),
    );

    service.clearSession("session-2");
  });
});

describe("ExternalAudioService voice markup streaming", () => {
  it("uses the Luma welcome turn for audio, alignment, and completion", async () => {
    const socket = { sendTTSTrigger: jest.fn() };
    const session = {
      sessionId: "session-1",
      socket: socket as unknown as LumaSocket,
      activeTurnId: null,
      pendingTtsTrigger: false,
      audioOutputErrors: new Map(),
    } as ExternalAudioSession;
    const sessionStore = new ExternalAudioSessionStore();
    sessionStore.set(session);
    const realtimePublisher = { emitToRoom: jest.fn() };
    const service = new ExternalAudioService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      sessionStore,
      {} as never,
      realtimePublisher as never,
    );
    const handlers = service["createVoiceMentorSocketHandlers"](session);
    await service.triggerTTS("session-1", { content: "Welcome" });
    const envelope = { sessionId: "session-1", jobId: "luma-welcome-1", tsMs: 1 };
    handlers.audioOutputAlignment({
      ...envelope,
      type: LUMA_MENTOR_STREAM_EVENT_TYPES.AUDIO_OUTPUT_ALIGNMENT,
      data: { sequence: 1, words: [{ text: "Welcome", startMs: 0, endMs: 500 }] },
    });
    handlers.audioOutputChunk({
      ...envelope,
      type: LUMA_MENTOR_STREAM_EVENT_TYPES.AUDIO_OUTPUT_CHUNK,
      data: { seq: 0, codec: "pcm_s16le", chunkBase64: "AAAA", sampleRate: 44100 },
    });
    for (const event of [
      VOICE_SOCKET_EVENT.AUDIO_OUTPUT_ALIGNMENT,
      VOICE_SOCKET_EVENT.AUDIO_SPEECH,
    ]) {
      expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
        event,
        "session-1",
        expect.objectContaining({ turnId: envelope.jobId }),
      );
    }
    handlers.audioOutputComplete({
      ...envelope,
      type: LUMA_MENTOR_STREAM_EVENT_TYPES.AUDIO_OUTPUT_COMPLETE,
      data: { totalChunks: 1 },
    });
    expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
      VOICE_SOCKET_EVENT.AUDIO_OUTPUT_COMPLETED,
      "session-1",
      { turnId: envelope.jobId },
    );
    expect(session.activeTurnId).toBeNull();
    expect(session.pendingTtsTrigger).toBe(false);
  });

  it.each(["core", "luma"])(
    "keeps raw %s speech markup separate from display events across character chunks",
    async (source) => {
      const raw = "⟦emotion:neutral⟧Wynik: ⟦say:zero przecinek cztery siedem⟧0,47⟦/say⟧. <button";
      const display = "Wynik: 0,47. <button";
      const socket = {
        sendMentorTextDelta: jest.fn(),
        sendMentorTextEnd: jest.fn(),
        sendMentorTextError: jest.fn(),
      };
      const realtimePublisher = { emitToRoom: jest.fn() };
      const sessionStore = new ExternalAudioSessionStore();
      sessionStore.set({
        sessionId: "session-1",
        socket: socket as unknown as LumaSocket,
        currentUser,
        threadId: "thread-1",
        lessonId: "lesson-1",
        userId: currentUser.userId,
        sessionRunId: "run-1",
        recoveryState: "connected",
        recoveryAttempt: 0,
        recoveryRequestPending: false,
        lastSentAudioSeq: 0,
        unacknowledgedChunks: new Map(),
        deferredOperations: [],
        recoveryTimeout: null,
        recoveryRetryTimeout: null,
        clientDisconnectTimeout: null,
        activeTurnId: null,
        pendingTtsTrigger: false,
        audioOutputErrors: new Map(),
        pendingInterruption: false,
        interruptedTurnIds: new Set(),
        activeMentorStream: null,
      });
      const service = new ExternalAudioService(
        {} as never,
        {} as never,
        {
          streamMessage: jest.fn().mockResolvedValue({
            source,
            textStream: (async function* () {
              for (const character of raw) yield character;
            })(),
          }),
        } as never,
        {} as never,
        {} as never,
        sessionStore,
        {
          runWithTenant: async (_tenantId: string, callback: () => Promise<void>) => callback(),
        } as never,
        realtimePublisher as never,
      );
      await service["handleLearnerTranscription"]("session-1", {
        jobId: "turn-1",
        data: {
          text: "Ile?",
          status: "final",
          turnId: "turn-1",
          segmentId: "segment-1",
          revision: 1,
        },
      } as never);

      const visibleDeltas = realtimePublisher.emitToRoom.mock.calls
        .filter(([event]) => event === VOICE_SOCKET_EVENT.MENTOR_RESPONSE_DELTA)
        .map(([, , payload]) => payload.text)
        .join("");
      expect(visibleDeltas).toBe(display);
      expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
        VOICE_SOCKET_EVENT.MENTOR_RESPONSE_COMPLETED,
        "session-1",
        { text: display, jobId: "turn-1", reason: "complete" },
      );
      if (source === "core") {
        expect(
          socket.sendMentorTextDelta.mock.calls.map(([payload]) => payload.text).join(""),
        ).toBe(raw);
        expect(socket.sendMentorTextEnd).toHaveBeenCalledWith({
          type: "mentor.text.end",
          jobId: "turn-1",
          reason: "complete",
        });
      } else {
        expect(socket.sendMentorTextDelta).not.toHaveBeenCalled();
      }
    },
  );
});
