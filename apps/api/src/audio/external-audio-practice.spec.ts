import { createLumaSocket, LEARNER_TRANSCRIPT_STATUSES } from "@japro/luma-sdk";
import {
  AI_MENTOR_PRACTICE_STATUSES,
  AI_MENTOR_TTS_PRESET,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  VOICE_ACTION,
} from "@repo/shared";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { ExternalAudioSessionStore } from "src/audio/external-audio-session.store";
import { ExternalAudioService } from "src/audio/external-audio.service";

import type { LearnerTranscriptionPayload, LumaSocket } from "@japro/luma-sdk";
import type { StartAudioBody } from "src/audio/types/audio.types";
import type { WsUser } from "src/websocket/websocket.types";

jest.mock("@japro/luma-sdk", () => ({
  ...jest.requireActual("@japro/luma-sdk"),
  createLumaSocket: jest.fn(),
}));

const practiceId = "00000000-0000-4000-8000-000000000001";
const threadId = "00000000-0000-4000-8000-000000000002";
const user: WsUser = {
  userId: "learner-1",
  tenantId: "tenant-1",
  email: "learner@example.com",
  permissions: [],
  roleSlugs: [],
};
const payload: StartAudioBody = {
  voiceAction: VOICE_ACTION.VOICE_MENTOR,
  practiceSessionId: practiceId,
  threadId,
  meta: { sr: 16000, channels: 1, format: "pcm_s16le" },
};
const readyPractice = {
  id: practiceId,
  tenantId: user.tenantId,
  userId: user.userId,
  status: AI_MENTOR_PRACTICE_STATUSES.READY,
  threadStatus: THREAD_STATUS.ACTIVE,
  threadId,
  language: SUPPORTED_LANGUAGES.PL,
};

function setup(practice: unknown = readyPractice) {
  const socket = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    startAudio: jest.fn(),
    stopAudio: jest.fn(),
    on: jest.fn(),
    sendMentorTextDelta: jest.fn(),
    sendMentorTextEnd: jest.fn(),
    onAudioChunked: jest.fn(),
    onAudioChunkError: jest.fn(),
    onAudioRecovered: jest.fn(),
    onAudioReconnectError: jest.fn(),
    onLearnerTranscription: jest.fn(
      (_handler: (event: LearnerTranscriptionPayload) => Promise<void>) => undefined,
    ),
    onAudioOutputAlignment: jest.fn(),
    onAudioOutputChunk: jest.fn(),
    onAudioOutputInterrupted: jest.fn(),
    onAudioOutputError: jest.fn(),
    onAudioOutputComplete: jest.fn(),
    onAudioStarted: jest.fn(),
  };
  jest.mocked(createLumaSocket).mockReturnValue(socket as unknown as LumaSocket);
  const repository = {
    findPracticeSessionById: jest.fn().mockResolvedValue(practice),
    checkLessonAssignment: jest.fn().mockResolvedValue([{ isAssigned: true }]),
    findAiMentorVoiceConfigByLessonId: jest.fn().mockResolvedValue({
      voiceMode: "PRESET",
      ttsPreset: AI_MENTOR_TTS_PRESET.FEMALE,
      customTtsReference: null,
    }),
  };
  const threadService = {
    createThreadIfNoneExist: jest.fn().mockResolvedValue({
      thread: { id: threadId, userLanguage: SUPPORTED_LANGUAGES.EN },
    }),
  };
  const localization = {
    getBaseLanguage: jest.fn().mockResolvedValue({ language: SUPPORTED_LANGUAGES.DE }),
  };
  const store = new ExternalAudioSessionStore();
  const aiService = {
    streamMessage: jest.fn().mockResolvedValue({
      source: AI_RUNTIME_SOURCES.CORE,
      textStream: (async function* () {
        yield "Mentor reply";
      })(),
    }),
  };
  const publisher = { emitToRoom: jest.fn() };
  const service = new ExternalAudioService(
    { getEnv: jest.fn().mockResolvedValue({ value: "test-key" }) } as never,
    repository as never,
    aiService as never,
    threadService as never,
    localization as never,
    store,
    { runWithTenant: async (_tenantId: string, work: () => Promise<void>) => work() } as never,
    publisher as never,
  );
  return { service, socket, store, repository, threadService, localization, aiService, publisher };
}

describe("Practice voice sessions", () => {
  const originalBaseUrl = process.env.LUMA_BASE_URL;
  beforeEach(() => {
    process.env.LUMA_BASE_URL = "http://luma.test";
  });
  afterEach(() => {
    jest.clearAllMocks();
    if (originalBaseUrl === undefined) delete process.env.LUMA_BASE_URL;
    else process.env.LUMA_BASE_URL = originalBaseUrl;
  });

  it("opens the exact owned attempt in its language without course access or a new thread", async () => {
    const { service, socket, store, repository, threadService, localization } = setup();
    await expect(service.startAudio("socket-1", user, payload)).resolves.toEqual({ ok: true });
    expect(store.get("socket-1")).toMatchObject({ threadId, practiceSessionId: practiceId });
    expect(store.get("socket-1")?.lessonId).toBeUndefined();
    expect(repository.checkLessonAssignment).not.toHaveBeenCalled();
    expect(repository.findAiMentorVoiceConfigByLessonId).not.toHaveBeenCalled();
    expect(threadService.createThreadIfNoneExist).not.toHaveBeenCalled();
    expect(localization.getBaseLanguage).not.toHaveBeenCalled();
    expect(socket.startAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        language: SUPPORTED_LANGUAGES.PL,
        preset: AI_MENTOR_TTS_PRESET.MALE,
      }),
    );
    expect(createLumaSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        socketData: { sessionId: "socket-1", userId: user.userId, lessonId: "" },
      }),
    );
  });

  it.each([
    ["missing", null],
    ["another owner", { ...readyPractice, userId: "other-user" }],
    ["another tenant", { ...readyPractice, tenantId: "other-tenant" }],
    ["not ready", { ...readyPractice, status: AI_MENTOR_PRACTICE_STATUSES.PROCESSING }],
    ["completed", { ...readyPractice, threadStatus: THREAD_STATUS.COMPLETED }],
    ["archived", { ...readyPractice, threadStatus: THREAD_STATUS.ARCHIVED }],
    ["stale attempt", { ...readyPractice, threadId: "00000000-0000-4000-8000-000000000003" }],
  ])("rejects a %s Practice even for a course administrator", async (_name, practice) => {
    const { service, store } = setup(practice);
    await expect(
      service.startAudio(
        "socket-1",
        { ...user, permissions: [PERMISSIONS.COURSE_UPDATE] },
        payload,
      ),
    ).resolves.toEqual({ ok: false, translationKey: "common.toast.noAccess" });
    expect(createLumaSocket).not.toHaveBeenCalled();
    expect(store.has("socket-1")).toBe(false);
  });

  it.each([
    { ...payload, lessonId: practiceId },
    { ...payload, threadId: undefined },
    { ...payload, practiceSessionId: undefined },
    { ...payload, practiceSessionId: "invalid" },
    { ...payload, threadId: "invalid" },
  ])("rejects ambiguous or incomplete Practice targets before querying", async (input) => {
    const { service, repository } = setup();
    await expect(service.startAudio("socket-1", user, input)).resolves.toMatchObject({ ok: false });
    expect(repository.findPracticeSessionById).not.toHaveBeenCalled();
    expect(createLumaSocket).not.toHaveBeenCalled();
  });

  it("preserves the lesson access, thread, language, and voice configuration path", async () => {
    const { service, socket, repository, threadService } = setup();
    await expect(
      service.startAudio("socket-1", user, {
        voiceAction: payload.voiceAction,
        meta: payload.meta,
        lessonId: practiceId,
      }),
    ).resolves.toEqual({ ok: true });
    expect(repository.checkLessonAssignment).toHaveBeenCalledWith(practiceId, user.userId);
    expect(repository.findPracticeSessionById).not.toHaveBeenCalled();
    expect(threadService.createThreadIfNoneExist).toHaveBeenCalled();
    expect(socket.startAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        language: SUPPORTED_LANGUAGES.DE,
        preset: AI_MENTOR_TTS_PRESET.FEMALE,
      }),
    );
  });

  it("routes a spoken turn through the existing Practice thread", async () => {
    const { service, socket, aiService } = setup();
    await service.startAudio("socket-1", user, payload);
    const onTranscription = socket.onLearnerTranscription.mock.calls[0][0] as (
      event: LearnerTranscriptionPayload,
    ) => Promise<void>;
    await onTranscription({
      jobId: "turn-1",
      data: { text: "My answer", status: LEARNER_TRANSCRIPT_STATUSES.FINAL },
    } as LearnerTranscriptionPayload);
    expect(aiService.streamMessage).toHaveBeenCalledWith(
      expect.objectContaining({ threadId, lessonId: undefined, content: "My answer" }),
      expect.anything(),
      user,
      true,
    );
  });

  it("does not publish a late response after the voice session is closed", async () => {
    const { service, socket, aiService, publisher } = setup();
    let resolveStream!: (value: unknown) => void;
    aiService.streamMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStream = resolve;
        }),
    );
    await service.startAudio("socket-1", user, payload);
    const onTranscription = socket.onLearnerTranscription.mock.calls[0][0] as (
      event: LearnerTranscriptionPayload,
    ) => Promise<void>;
    const turn = onTranscription({
      jobId: "turn-1",
      data: { text: "My answer", status: LEARNER_TRANSCRIPT_STATUSES.FINAL },
    } as LearnerTranscriptionPayload);
    await service.cancelAudio("socket-1");
    publisher.emitToRoom.mockClear();
    resolveStream({
      source: AI_RUNTIME_SOURCES.CORE,
      textStream: (async function* () {
        yield "Late reply";
      })(),
    });
    await turn;
    expect(publisher.emitToRoom).not.toHaveBeenCalled();
    expect(socket.sendMentorTextDelta).not.toHaveBeenCalled();
  });

  it("aborts the previous stream and binds a replay to the new attempt", async () => {
    const { service, store, repository, socket } = setup();
    await service.startAudio("socket-1", user, payload);
    const session = store.get("socket-1")!;
    const abortController = new AbortController();
    session.activeMentorStream = { turnId: "turn-1", abortController };
    const nextThreadId = "00000000-0000-4000-8000-000000000003";
    repository.findPracticeSessionById.mockResolvedValue({
      ...readyPractice,
      threadId: nextThreadId,
    });
    await service.startAudio("socket-1", user, { ...payload, threadId: nextThreadId });
    expect(abortController.signal.aborted).toBe(true);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(store.get("socket-1")?.threadId).toBe(nextThreadId);
  });
});
