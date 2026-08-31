import {
  createLumaSocket,
  LUMA_AUDIO_ACTIONS,
  LUMA_AUDIO_FORMATS,
  LUMA_SOCKET_MESSAGE_TYPES,
  type AudioChunkPayload,
  type AudioChunkedPayload,
  type AudioStartedPayload,
  type AudioOutputErrorPayload,
  type AudioOutputCompletePayload,
  type AudioOutputAlignmentPayload,
  type AudioOutputInterruptedPayload,
  type AudioProtocolErrorPayload,
  type AudioReconnectPayload,
  type AudioRecoveryPayload,
  type AudioStopPayload,
  type ClientSpeechBoundaryPayload as LumaClientSpeechBoundaryPayload,
  type LearnerTranscriptionPayload,
  LEARNER_TRANSCRIPT_STATUSES,
  type StartAudioPayload,
  TRANSCRIPTION_MODES,
} from "@japro/luma-sdk";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AI_MENTOR_TTS_PRESET,
  AI_MENTOR_VOICE_MODE,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  VOICE_ACTION,
  VOICE_SOCKET_EVENT,
} from "@repo/shared";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiService } from "src/ai/services/ai.service";
import { ThreadService } from "src/ai/services/thread.service";
import { OPENAI_MODELS, THREAD_STATUS } from "src/ai/utils/ai.type";
import { stripVoiceControlTags } from "src/ai/utils/voiceControlTags";
import {
  EXTERNAL_AUDIO_CLIENT_RECONNECT_GRACE_MS,
  EXTERNAL_AUDIO_MAX_BUFFERED_CHUNKS,
  EXTERNAL_AUDIO_MAX_RECOVERY_ATTEMPTS,
  EXTERNAL_AUDIO_OPERATION,
  EXTERNAL_AUDIO_RECOVERY_STATE,
  EXTERNAL_AUDIO_RECOVERY_TIMEOUT_MS,
  EXTERNAL_AUDIO_TERMINAL_RECOVERY_ERROR_CODES,
} from "src/audio/constants/external-audio.constants";
import { ExternalAudioSessionStore } from "src/audio/external-audio-session.store";
import { hasAnyPermission } from "src/common/permissions/permission.utils";
import { EnvService } from "src/env/services/env.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { REALTIME_PUBLISHER, type RealtimePublisher } from "src/websocket/realtime.publisher";

import type {
  AiMentorTTSPreset,
  AudioSpeechEventPayload,
  AudioOutputAlignmentEventPayload,
  ClientSpeechBoundaryPayload,
  MentorResponseDeltaEventPayload,
  MentorResponseCompletedEventPayload,
  LearnerTranscriptionEventPayload,
  PcmChunkMeta,
  SupportedLanguages,
} from "@repo/shared";
import type { AiVoiceDeliveryContext } from "src/ai/ai-chat.types";
import type { SendTTSTriggerBody, StartAudioBody } from "src/audio/types/audio.types";
import type {
  ExternalAudioChunkOperation,
  ExternalAudioSession,
  ExternalAudioSpeechBoundaryOperation,
} from "src/audio/types/external-audio-session.types";
import type { ExternalAudioStartResult } from "src/audio/types/external-audio.types";
import type { UUIDType } from "src/common";
import type { WsUser } from "src/websocket/websocket.types";

type VoiceMentorSocketHandlers = {
  connect: () => void;
  disconnect: () => void;
  audioStarted: (payload: AudioStartedPayload) => void;
  audioChunked: (payload: AudioChunkedPayload) => void;
  audioChunkError: (payload: AudioProtocolErrorPayload) => void;
  audioRecovered: (payload: AudioRecoveryPayload) => void;
  audioReconnectError: (payload: AudioProtocolErrorPayload) => void;
  learnerTranscription: (payload: LearnerTranscriptionPayload) => Promise<void>;
  audioOutputAlignment: (payload: AudioOutputAlignmentPayload) => void;
  audioOutputChunk: (payload: { data: AudioSpeechEventPayload }) => void;
  audioOutputInterrupted: (payload: AudioOutputInterruptedPayload) => void;
  audioOutputError: (payload: AudioOutputErrorPayload) => void;
  audioOutputComplete: (payload: AudioOutputCompletePayload) => void;
};

@Injectable()
export class ExternalAudioService {
  private readonly logger = new Logger(ExternalAudioService.name);
  private static readonly MENTOR_DELTA_FLUSH_MAX_CHARS = 140;

  constructor(
    private readonly envService: EnvService,
    private readonly aiRepository: AiRepository,
    private readonly aiService: AiService,
    private readonly threadService: ThreadService,
    private readonly localizationService: LocalizationService,
    private readonly sessionStore: ExternalAudioSessionStore,
    private readonly tenantDbRunner: TenantDbRunnerService,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher,
  ) {}

  async startAudio(
    sessionId: string,
    currentUser: WsUser,
    payload: StartAudioBody,
  ): Promise<ExternalAudioStartResult> {
    switch (payload.voiceAction) {
      case VOICE_ACTION.VOICE_MENTOR:
        return this.startAudioForVoiceMentor(sessionId, currentUser, payload);
      default:
        return { ok: false, translationKey: "common.toast.somethingWentWrong" };
    }
  }

  async audioChunk(sessionId: string, meta: PcmChunkMeta, bytes: Buffer): Promise<boolean> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return false;
    }

    const audioChunkPayload: AudioChunkPayload = {
      type: LUMA_SOCKET_MESSAGE_TYPES.AUDIO_CHUNK,
      meta: {
        seq: meta.seq,
        sr: meta.sr,
        samples: meta.samples,
        tsMs: Math.trunc(meta.ts_ms),
      },
    };

    const operation = {
      type: EXTERNAL_AUDIO_OPERATION.CHUNK,
      payload: audioChunkPayload,
      bytes: Buffer.from(bytes),
    } as const;

    if (
      !session.unacknowledgedChunks.has(meta.seq) &&
      session.unacknowledgedChunks.size >= EXTERNAL_AUDIO_MAX_BUFFERED_CHUNKS
    ) {
      this.failRecovery(session, "AUDIO_SEQUENCE_RECOVERY_BUFFER_FULL");
      return false;
    }

    session.unacknowledgedChunks.set(meta.seq, operation);
    if (session.recoveryState === EXTERNAL_AUDIO_RECOVERY_STATE.RECOVERING) {
      session.deferredOperations.push(operation);
      return true;
    }

    if (!session.socket.connected) {
      session.deferredOperations.push(operation);
      this.beginRecovery(session);
      return true;
    }

    this.sendChunkOperation(session, operation);
    return true;
  }

  async clientSpeechStart(
    sessionId: string,
    payload: ClientSpeechBoundaryPayload,
  ): Promise<boolean> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return false;
    }

    const boundary: LumaClientSpeechBoundaryPayload = {
      type: LUMA_SOCKET_MESSAGE_TYPES.CLIENT_SPEECH_START,
      sessionRunId: payload.sessionRunId,
      boundarySeq: payload.boundarySeq,
      tsMs: Math.trunc(payload.tsMs),
      lastAudioSeq: payload.lastAudioSeq,
    };
    this.sendOrDeferBoundary(session, {
      type: EXTERNAL_AUDIO_OPERATION.SPEECH_START,
      payload: boundary,
    });
    return true;
  }

  async clientSpeechEnd(sessionId: string, payload: ClientSpeechBoundaryPayload): Promise<boolean> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return false;
    }

    const boundary: LumaClientSpeechBoundaryPayload = {
      type: LUMA_SOCKET_MESSAGE_TYPES.CLIENT_SPEECH_END,
      sessionRunId: payload.sessionRunId,
      boundarySeq: payload.boundarySeq,
      tsMs: Math.trunc(payload.tsMs),
      lastAudioSeq: payload.lastAudioSeq,
    };
    this.sendOrDeferBoundary(session, {
      type: EXTERNAL_AUDIO_OPERATION.SPEECH_END,
      payload: boundary,
    });
    return true;
  }

  hasSession(sessionId: string): boolean {
    return this.sessionStore.has(sessionId);
  }

  reconnectAudio(sessionId: string, currentUser: WsUser, payload: AudioReconnectPayload): boolean {
    const session = this.sessionStore.findBySessionRunId(payload.sessionRunId);
    if (
      !session ||
      session.currentUser.userId !== currentUser.userId ||
      session.currentUser.tenantId !== currentUser.tenantId
    ) {
      return false;
    }

    if (session.clientDisconnectTimeout) {
      clearTimeout(session.clientDisconnectTimeout);
      session.clientDisconnectTimeout = null;
    }

    this.sessionStore.rebind(session, sessionId);
    session.recoveryAttempt = Math.max(session.recoveryAttempt, payload.attempt - 1);
    this.beginRecovery(session);
    this.requestRecovery(session);
    return true;
  }

  handleClientDisconnect(sessionId: string): boolean {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.clientDisconnectTimeout) {
      clearTimeout(session.clientDisconnectTimeout);
    }
    session.clientDisconnectTimeout = setTimeout(() => {
      this.clearSession(session.sessionId);
    }, EXTERNAL_AUDIO_CLIENT_RECONNECT_GRACE_MS);
    return true;
  }

  async stopAudio(sessionId: string): Promise<void> {
    const session = this.sessionStore.get(sessionId);
    if (session) {
      session.socket.stopAudio(this.buildStopAudioPayload());
    }
  }

  async cancelAudio(sessionId: string): Promise<void> {
    const session = this.sessionStore.get(sessionId);
    if (session) {
      session.socket.stopAudio(this.buildStopAudioPayload());
    }

    this.clearSession(sessionId);
  }

  clearSession(sessionId: string): void {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return;
    }

    this.clearRecoveryTimers(session);
    session.socket.removeAllListeners();
    session.socket.disconnect();
    this.sessionStore.delete(sessionId);
  }

  async triggerTTS(sessionId: string, payload: SendTTSTriggerBody) {
    const session = this.sessionStore.get(sessionId);
    if (session) {
      session.activeTurnId = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      session.socket.sendTTSTrigger(payload);
      return true;
    }

    return false;
  }

  private async startAudioForVoiceMentor(
    sessionId: string,
    currentUser: WsUser,
    payload: StartAudioBody,
  ): Promise<ExternalAudioStartResult> {
    if (!payload.lessonId) {
      return { ok: false, translationKey: "common.toast.somethingWentWrong" };
    }

    if (this.sessionStore.has(sessionId)) {
      return { ok: true };
    }

    const hasLessonAccess = await this.canAccessLesson(payload.lessonId, currentUser);
    if (!hasLessonAccess) {
      return { ok: false, translationKey: "common.toast.noAccess" };
    }

    const apiKey = await this.envService
      .getEnv("LUMA_API_KEY")
      .then((result) => result.value)
      .catch(() => process.env.LUMA_API_KEY);
    const baseURL = process.env.LUMA_BASE_URL;

    if (!apiKey || !baseURL) {
      this.logger.warn(`Missing Luma config for external session ${sessionId}`);
      return { ok: false, translationKey: "adminCourseView.toast.lumaNotConfigured" };
    }

    const threadData = await this.threadService.createThreadIfNoneExist({
      lessonId: payload.lessonId,
      userId: currentUser.userId,
      userLanguage: SUPPORTED_LANGUAGES.EN,
      status: THREAD_STATUS.ACTIVE,
    });

    const { language: lessonLanguage } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      payload.lessonId,
      threadData.thread.userLanguage as SupportedLanguages,
    );
    const voiceConfig = await this.aiRepository.findAiMentorVoiceConfigByLessonId(
      payload.lessonId,
      lessonLanguage,
    );
    const voiceStartConfig = this.resolveVoiceStartConfig(voiceConfig);

    const socket = createLumaSocket({
      apiKey,
      baseURL,
      socketData: {
        sessionId,
        userId: currentUser.userId,
        lessonId: payload.lessonId,
      },
    });

    const session: ExternalAudioSession = {
      sessionId,
      socket,
      currentUser,
      threadId: threadData.thread.id,
      lessonId: payload.lessonId,
      userId: currentUser.userId,
      sessionRunId: null,
      recoveryState: EXTERNAL_AUDIO_RECOVERY_STATE.CONNECTED,
      recoveryAttempt: 0,
      recoveryRequestPending: false,
      lastSentAudioSeq: -1,
      unacknowledgedChunks: new Map(),
      deferredOperations: [],
      recoveryTimeout: null,
      recoveryRetryTimeout: null,
      clientDisconnectTimeout: null,
      activeTurnId: null,
      audioOutputErrors: new Map(),
      pendingInterruption: false,
      interruptedTurnIds: new Set(),
      activeMentorStream: null,
    };

    this.registerVoiceMentorHandlers(session);
    this.sessionStore.set(session);

    socket.connect();
    socket.startAudio(this.buildStartAudioPayload(payload, lessonLanguage, voiceStartConfig));

    return { ok: true };
  }

  private registerVoiceMentorHandlers(session: ExternalAudioSession): void {
    const { socket } = session;
    const handlers = this.createVoiceMentorSocketHandlers(session);

    socket.on("connect", handlers.connect);
    socket.on("disconnect", handlers.disconnect);
    socket.onAudioChunked(handlers.audioChunked);
    socket.onAudioChunkError(handlers.audioChunkError);
    socket.onAudioRecovered(handlers.audioRecovered);
    socket.onAudioReconnectError(handlers.audioReconnectError);
    socket.onLearnerTranscription(handlers.learnerTranscription);
    socket.onAudioOutputAlignment(handlers.audioOutputAlignment);
    socket.onAudioOutputChunk(handlers.audioOutputChunk);
    socket.onAudioOutputInterrupted(handlers.audioOutputInterrupted);
    socket.onAudioOutputError(handlers.audioOutputError);
    socket.onAudioOutputComplete(handlers.audioOutputComplete);
    socket.onAudioStarted(handlers.audioStarted);
  }

  private createVoiceMentorSocketHandlers(
    session: ExternalAudioSession,
  ): VoiceMentorSocketHandlers {
    return {
      connect: () => {
        if (
          session.sessionRunId &&
          session.recoveryState === EXTERNAL_AUDIO_RECOVERY_STATE.RECOVERING
        ) {
          this.requestRecovery(session);
        }
      },
      disconnect: () => {
        if (session.sessionRunId) {
          this.beginRecovery(session);
        }
      },
      audioStarted: (payload) => {
        session.sessionRunId = payload.sessionRunId;
        session.recoveryAttempt = 0;
        session.recoveryState = EXTERNAL_AUDIO_RECOVERY_STATE.CONNECTED;
        this.acknowledgeChunks(session, payload.nextAudioSeq);
        this.realtimePublisher.emitToRoom(
          VOICE_SOCKET_EVENT.AUDIO_STARTED,
          session.sessionId,
          payload,
        );
      },
      audioChunked: (payload) => {
        if (payload.sessionRunId !== session.sessionRunId) {
          return;
        }

        this.acknowledgeChunks(session, payload.nextAudioSeq);
        this.realtimePublisher.emitToRoom(
          VOICE_SOCKET_EVENT.AUDIO_CHUNK_ACCEPTED,
          session.sessionId,
          payload,
        );
      },
      audioChunkError: (payload) => {
        this.realtimePublisher.emitToRoom(
          VOICE_SOCKET_EVENT.AUDIO_CHUNK_ERROR,
          session.sessionId,
          payload,
        );
        this.beginRecovery(session);
        this.requestRecovery(session);
      },
      audioRecovered: (payload) => {
        this.handleRecovered(session, payload);
      },
      audioReconnectError: (payload) => {
        this.handleReconnectError(session, payload);
      },
      learnerTranscription: async (payload) => {
        await this.handleLearnerTranscription(session.sessionId, payload);
      },
      audioOutputAlignment: (payload) => {
        const nextPayload: AudioOutputAlignmentEventPayload = {
          turnId: payload.jobId,
          sequence: payload.data.sequence,
          words: payload.data.words,
        };
        this.realtimePublisher.emitToRoom(
          VOICE_SOCKET_EVENT.AUDIO_OUTPUT_ALIGNMENT,
          session.sessionId,
          nextPayload,
        );
      },
      audioOutputChunk: (payload) => {
        if (!session.activeTurnId) {
          return;
        }

        const nextPayload = {
          seq: payload.data.seq,
          codec: payload.data.codec,
          chunkBase64: payload.data.chunkBase64,
          sampleRate: payload.data.sampleRate,
          turnId: session.activeTurnId,
        };
        this.realtimePublisher.emitToRoom(
          VOICE_SOCKET_EVENT.AUDIO_SPEECH,
          session.sessionId,
          nextPayload,
        );
      },
      audioOutputInterrupted: (payload) => {
        const reportedTurnId = payload.data.interruptedTurnId;
        const activeStreamTurnId = session.activeMentorStream?.turnId ?? null;
        const interruptedTurnId = reportedTurnId === null ? activeStreamTurnId : reportedTurnId;
        const nextPayload = {
          turnId: interruptedTurnId ?? undefined,
        };
        this.realtimePublisher.emitToRoom(
          VOICE_SOCKET_EVENT.AUDIO_INTERRUPTED,
          session.sessionId,
          nextPayload,
        );
        const interruptedCurrentTurn =
          interruptedTurnId !== null &&
          (session.activeTurnId === interruptedTurnId || activeStreamTurnId === interruptedTurnId);
        if (interruptedCurrentTurn) {
          session.pendingInterruption = true;
        }
        if (interruptedTurnId && activeStreamTurnId === interruptedTurnId) {
          session.interruptedTurnIds.add(interruptedTurnId);
          session.activeMentorStream?.abortController.abort("MENTOR_RESPONSE_INTERRUPTED");
        }
        if (interruptedTurnId) {
          session.audioOutputErrors.delete(interruptedTurnId);
        }
        if (session.activeTurnId === interruptedTurnId) {
          session.activeTurnId = null;
        }
      },
      audioOutputError: (payload) => {
        if (!session.activeTurnId || payload.jobId !== session.activeTurnId) {
          return;
        }

        session.audioOutputErrors.set(payload.jobId, payload.data);
        if (session.activeMentorStream?.turnId === payload.jobId) {
          session.activeMentorStream.abortController.abort("TTS_STREAM_ERROR");
        }
        this.logger.warn(
          `Luma audio output failed for mentor turn ${payload.jobId} in session ${session.sessionId}: ${payload.data.code}`,
        );
      },
      audioOutputComplete: (payload) => {
        const completedTurnId =
          session.activeTurnId && payload.jobId === session.activeTurnId
            ? session.activeTurnId
            : null;
        const nextPayload = {
          turnId: completedTurnId ?? undefined,
        };
        this.realtimePublisher.emitToRoom(
          VOICE_SOCKET_EVENT.AUDIO_OUTPUT_COMPLETED,
          session.sessionId,
          nextPayload,
        );
        if (completedTurnId) {
          session.audioOutputErrors.delete(completedTurnId);
        }
        if (session.activeTurnId === completedTurnId) {
          session.activeTurnId = null;
        }
      },
    };
  }

  private sendChunkOperation(
    session: ExternalAudioSession,
    operation: ExternalAudioChunkOperation,
  ): void {
    session.socket.sendAudioChunk(operation.payload, operation.bytes);
    session.lastSentAudioSeq = Math.max(session.lastSentAudioSeq, operation.payload.meta.seq);
  }

  private sendOrDeferBoundary(
    session: ExternalAudioSession,
    operation: ExternalAudioSpeechBoundaryOperation,
  ): void {
    if (
      session.recoveryState === EXTERNAL_AUDIO_RECOVERY_STATE.RECOVERING ||
      !session.socket.connected
    ) {
      session.deferredOperations.push(operation);
      this.beginRecovery(session);
      return;
    }

    this.sendBoundaryOperation(session, operation);
  }

  private sendBoundaryOperation(
    session: ExternalAudioSession,
    operation: ExternalAudioSpeechBoundaryOperation,
  ): void {
    if (operation.type === EXTERNAL_AUDIO_OPERATION.SPEECH_START) {
      session.socket.sendClientSpeechStart(operation.payload);
      return;
    }

    session.socket.sendClientSpeechEnd(operation.payload);
  }

  private beginRecovery(session: ExternalAudioSession): void {
    if (session.recoveryState === EXTERNAL_AUDIO_RECOVERY_STATE.RECOVERING) {
      return;
    }

    session.recoveryState = EXTERNAL_AUDIO_RECOVERY_STATE.RECOVERING;
    this.realtimePublisher.emitToRoom(
      VOICE_SOCKET_EVENT.AUDIO_RECOVERY_STARTED,
      session.sessionId,
      { attempt: session.recoveryAttempt + 1 },
    );
    session.recoveryTimeout = setTimeout(() => {
      this.failRecovery(session, "AUDIO_RECOVERY_TIMEOUT");
    }, EXTERNAL_AUDIO_RECOVERY_TIMEOUT_MS);
  }

  private requestRecovery(session: ExternalAudioSession): void {
    if (
      !session.sessionRunId ||
      !session.socket.connected ||
      session.recoveryRequestPending ||
      session.recoveryState !== EXTERNAL_AUDIO_RECOVERY_STATE.RECOVERING
    ) {
      return;
    }

    if (session.recoveryAttempt >= EXTERNAL_AUDIO_MAX_RECOVERY_ATTEMPTS) {
      this.failRecovery(session, "AUDIO_RECOVERY_ATTEMPTS_EXHAUSTED");
      return;
    }

    session.recoveryAttempt += 1;
    session.recoveryRequestPending = true;
    session.socket.reconnectAudio({
      type: LUMA_SOCKET_MESSAGE_TYPES.AUDIO_RECONNECT,
      sessionRunId: session.sessionRunId,
      lastSentAudioSeq: Math.max(0, session.lastSentAudioSeq),
      attempt: session.recoveryAttempt,
    });
  }

  private handleRecovered(session: ExternalAudioSession, payload: AudioRecoveryPayload): void {
    if (payload.sessionRunId !== session.sessionRunId) {
      this.failRecovery(session, "AUDIO_SESSION_RUN_MISMATCH");
      return;
    }

    session.recoveryRequestPending = false;
    this.clearRecoveryAttemptTimers(session);
    this.acknowledgeChunks(session, payload.nextAudioSeq);

    const deferredChunkSequences = new Set(
      session.deferredOperations.flatMap((operation) =>
        operation.type === EXTERNAL_AUDIO_OPERATION.CHUNK ? [operation.payload.meta.seq] : [],
      ),
    );
    const replayOperations = [...session.unacknowledgedChunks.values()]
      .filter(
        (operation) =>
          operation.payload.meta.seq >= payload.nextAudioSeq &&
          !deferredChunkSequences.has(operation.payload.meta.seq),
      )
      .sort((left, right) => left.payload.meta.seq - right.payload.meta.seq);
    const firstReplaySequence = replayOperations[0]?.payload.meta.seq;
    if (
      payload.nextAudioSeq <= session.lastSentAudioSeq &&
      firstReplaySequence !== payload.nextAudioSeq
    ) {
      this.failRecovery(session, "AUDIO_SEQUENCE_RECOVERY_BUFFER_MISS");
      return;
    }

    for (const operation of replayOperations) {
      this.sendChunkOperation(session, operation);
    }

    const deferredOperations = session.deferredOperations.splice(0);
    for (const operation of deferredOperations) {
      if (
        operation.type === EXTERNAL_AUDIO_OPERATION.CHUNK &&
        operation.payload.meta.seq < payload.nextAudioSeq
      ) {
        continue;
      }

      if (operation.type === EXTERNAL_AUDIO_OPERATION.CHUNK) {
        this.sendChunkOperation(session, operation);
        continue;
      }

      this.sendBoundaryOperation(session, operation);
    }

    session.recoveryState = EXTERNAL_AUDIO_RECOVERY_STATE.CONNECTED;
    session.recoveryAttempt = 0;
    this.realtimePublisher.emitToRoom(
      VOICE_SOCKET_EVENT.AUDIO_RECOVERED,
      session.sessionId,
      payload,
    );
  }

  private handleReconnectError(
    session: ExternalAudioSession,
    payload: AudioProtocolErrorPayload,
  ): void {
    session.recoveryRequestPending = false;
    const isTerminal = EXTERNAL_AUDIO_TERMINAL_RECOVERY_ERROR_CODES.some(
      (code) => code === payload.code,
    );
    if (isTerminal || session.recoveryAttempt >= EXTERNAL_AUDIO_MAX_RECOVERY_ATTEMPTS) {
      this.failRecovery(session, payload.code);
      return;
    }

    if (session.recoveryRetryTimeout) {
      clearTimeout(session.recoveryRetryTimeout);
    }
    const retryDelayMs = Math.min(250 * session.recoveryAttempt, 2_000);
    session.recoveryRetryTimeout = setTimeout(() => {
      session.recoveryRetryTimeout = null;
      this.requestRecovery(session);
    }, retryDelayMs);
  }

  private acknowledgeChunks(session: ExternalAudioSession, nextAudioSeq: number): void {
    for (const sequence of session.unacknowledgedChunks.keys()) {
      if (sequence < nextAudioSeq) {
        session.unacknowledgedChunks.delete(sequence);
      }
    }
  }

  private failRecovery(session: ExternalAudioSession, code: string): void {
    if (session.recoveryState === EXTERNAL_AUDIO_RECOVERY_STATE.FAILED) {
      return;
    }

    session.recoveryState = EXTERNAL_AUDIO_RECOVERY_STATE.FAILED;
    this.clearRecoveryTimers(session);
    this.logger.warn(`Luma audio recovery failed for session ${session.sessionId}: ${code}`);
    this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.AUDIO_RECONNECT_ERROR, session.sessionId, {
      type: LUMA_SOCKET_MESSAGE_TYPES.AUDIO_RECONNECT,
      sessionId: session.sessionId,
      sessionRunId: session.sessionRunId ?? undefined,
      attempt: session.recoveryAttempt,
      code,
    });
    this.clearSession(session.sessionId);
  }

  private clearRecoveryAttemptTimers(session: ExternalAudioSession): void {
    if (session.recoveryTimeout) {
      clearTimeout(session.recoveryTimeout);
      session.recoveryTimeout = null;
    }
    if (session.recoveryRetryTimeout) {
      clearTimeout(session.recoveryRetryTimeout);
      session.recoveryRetryTimeout = null;
    }
  }

  private clearRecoveryTimers(session: ExternalAudioSession): void {
    this.clearRecoveryAttemptTimers(session);
    if (session.clientDisconnectTimeout) {
      clearTimeout(session.clientDisconnectTimeout);
      session.clientDisconnectTimeout = null;
    }
  }

  private async handleLearnerTranscription(
    sessionId: string,
    payload: LearnerTranscriptionPayload,
  ): Promise<void> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return;
    }

    const text = payload.data.text?.trim();
    if (!text) {
      return;
    }

    this.emitLearnerTranscription(sessionId, {
      text,
      jobId: payload.jobId,
      turnId: payload.data.turnId,
      segmentId: payload.data.segmentId,
      revision: payload.data.revision,
      status: payload.data.status,
    });

    if (payload.data.status === LEARNER_TRANSCRIPT_STATUSES.PARTIAL) {
      return;
    }

    const voiceDeliveryContext = this.resolveVoiceDeliveryContext(payload.data.timing);

    session.activeTurnId = payload.jobId ?? null;
    const voiceTurnWasInterrupted = session.pendingInterruption;
    session.pendingInterruption = false;
    const abortController = new AbortController();
    session.activeMentorStream = {
      turnId: payload.jobId,
      abortController,
    };

    let shouldForwardMentorText = true;
    let stoppedByAudioOutputError = false;
    try {
      await this.tenantDbRunner.runWithTenant(session.currentUser.tenantId, async () => {
        const stream = await this.aiService.streamMessage(
          {
            threadId: session.threadId,
            content: text,
            lessonId: session.lessonId,
            voiceSessionId: sessionId,
            voiceTurnId: payload.jobId,
            voiceTurnWasInterrupted,
            voiceDeliveryContext,
            abortSignal: abortController.signal,
          },
          OPENAI_MODELS.VOICE,
          session.currentUser,
          true,
        );
        shouldForwardMentorText = stream.source === AI_RUNTIME_SOURCES.CORE;

        let responseText = "";
        let pendingDeltaChunk = "";
        let seq = 1;
        for await (const delta of stream.textStream) {
          if (shouldForwardMentorText && session.audioOutputErrors.has(payload.jobId)) {
            stoppedByAudioOutputError = true;
            break;
          }
          if (!delta) continue;

          responseText += delta;
          pendingDeltaChunk += delta;

          if (!this.shouldFlushMentorDeltaChunk(pendingDeltaChunk)) {
            continue;
          }

          if (shouldForwardMentorText) {
            seq = this.sendMentorTextDeltaChunk(session, payload.jobId, pendingDeltaChunk, seq);
          }
          this.emitMentorResponseDelta(sessionId, {
            text: this.sanitizeMentorResponseDelta(pendingDeltaChunk),
            jobId: payload.jobId,
          });
          pendingDeltaChunk = "";
        }

        const wasInterrupted = session.interruptedTurnIds.delete(payload.jobId);
        if (wasInterrupted) {
          session.audioOutputErrors.delete(payload.jobId);
          this.emitMentorResponseCompleted(sessionId, {
            text: "",
            jobId: payload.jobId,
            reason: "error",
          });
          if (session.activeTurnId === payload.jobId) {
            session.activeTurnId = null;
          }
          return;
        }

        const audioOutputError = session.audioOutputErrors.get(payload.jobId);
        if (shouldForwardMentorText && (stoppedByAudioOutputError || audioOutputError)) {
          session.audioOutputErrors.delete(payload.jobId);
          session.socket.sendMentorTextError({
            type: "mentor.text.error",
            jobId: payload.jobId,
            code: audioOutputError?.code ?? "AUDIO_OUTPUT_ERROR",
            message: audioOutputError?.message ?? "Mentor audio output failed",
            retryable: audioOutputError?.retryable ?? false,
          });
          this.emitMentorResponseCompleted(sessionId, {
            text: "",
            jobId: payload.jobId,
            reason: "error",
          });
          if (session.activeTurnId === payload.jobId) {
            session.activeTurnId = null;
          }
          return;
        }

        if (shouldForwardMentorText && pendingDeltaChunk.length > 0) {
          seq = this.sendMentorTextDeltaChunk(session, payload.jobId, pendingDeltaChunk, seq);
        }
        if (pendingDeltaChunk.length > 0) {
          this.emitMentorResponseDelta(sessionId, {
            text: this.sanitizeMentorResponseDelta(pendingDeltaChunk),
            jobId: payload.jobId,
          });
        }

        if (shouldForwardMentorText) {
          session.socket.sendMentorTextEnd({
            type: "mentor.text.end",
            jobId: payload.jobId,
            reason: "complete",
          });
        }

        this.emitMentorResponseCompleted(sessionId, {
          text: stripVoiceControlTags(responseText.trim()),
          jobId: payload.jobId,
          reason: "complete",
        });
      });
    } catch (error) {
      this.logger.error("Failed to stream mentor response", error);

      const wasInterrupted = session.interruptedTurnIds.delete(payload.jobId);
      if (wasInterrupted) {
        session.audioOutputErrors.delete(payload.jobId);
        this.emitMentorResponseCompleted(sessionId, {
          text: "",
          jobId: payload.jobId,
          reason: "error",
        });
        if (session.activeTurnId === payload.jobId) {
          session.activeTurnId = null;
        }
        return;
      }

      const audioOutputError = session.audioOutputErrors.get(payload.jobId);
      if (shouldForwardMentorText && audioOutputError) {
        session.audioOutputErrors.delete(payload.jobId);
        session.socket.sendMentorTextError({
          type: "mentor.text.error",
          jobId: payload.jobId,
          code: audioOutputError.code,
          message: audioOutputError.message,
          retryable: audioOutputError.retryable,
        });
        this.emitMentorResponseCompleted(sessionId, {
          text: "",
          jobId: payload.jobId,
          reason: "error",
        });
        if (session.activeTurnId === payload.jobId) {
          session.activeTurnId = null;
        }
        return;
      }

      if (shouldForwardMentorText) {
        session.socket.sendMentorTextEnd({
          type: "mentor.text.end",
          jobId: payload.jobId,
          reason: "error",
        });
      }
      this.emitMentorResponseCompleted(sessionId, {
        text: "",
        jobId: payload.jobId,
        reason: "error",
      });
    } finally {
      if (session.activeMentorStream?.turnId === payload.jobId) {
        session.activeMentorStream = null;
      }
    }
  }

  private resolveVoiceDeliveryContext(
    timing: LearnerTranscriptionPayload["data"]["timing"],
  ): AiVoiceDeliveryContext | undefined {
    if (!timing) {
      return undefined;
    }

    const requiredValues = [
      timing.elapsedMs,
      timing.speechMs,
      timing.pauseCount,
      timing.longestPauseMs,
      timing.segmentCount,
      timing.wordCount,
    ];
    if (requiredValues.some((value) => this.toNonNegativeInteger(value) === undefined)) {
      return undefined;
    }

    const timingPrecision = timing.timingPrecision?.trim();
    if (!timingPrecision) {
      return undefined;
    }

    return {
      elapsedMs: this.toNonNegativeInteger(timing.elapsedMs) as number,
      speechMs: this.toNonNegativeInteger(timing.speechMs) as number,
      pauseCount: this.toNonNegativeInteger(timing.pauseCount) as number,
      longestPauseMs: this.toNonNegativeInteger(timing.longestPauseMs) as number,
      averagePauseMs: this.toOptionalNonNegativeInteger(timing.averagePauseMs),
      segmentCount: this.toNonNegativeInteger(timing.segmentCount) as number,
      wordCount: this.toNonNegativeInteger(timing.wordCount) as number,
      wordsPerMinute: this.toOptionalNonNegativeInteger(timing.wordsPerMinute),
      timingPrecision,
    };
  }

  private toNonNegativeInteger(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }

    return Math.max(0, Math.trunc(value));
  }

  private toOptionalNonNegativeInteger(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toNonNegativeInteger(value) ?? null;
  }

  private shouldFlushMentorDeltaChunk(chunk: string): boolean {
    if (this.hasIncompleteVoiceControlTag(chunk)) {
      return false;
    }

    if (chunk.length >= ExternalAudioService.MENTOR_DELTA_FLUSH_MAX_CHARS) {
      return true;
    }

    return /[.!?]\s*$/.test(chunk) || /\s$/.test(chunk);
  }

  private hasIncompleteVoiceControlTag(text: string): boolean {
    const lastOpeningBracket = text.lastIndexOf("<");
    const lastClosingBracket = text.lastIndexOf(">");
    if (lastOpeningBracket > lastClosingBracket) {
      const trailingTag = text.slice(lastOpeningBracket);
      if (/^<\/?(?:emotion|break|spell)\b/i.test(trailingTag)) {
        return true;
      }
    }

    const normalizedText = text.toLowerCase();
    const lastSpellOpening = normalizedText.lastIndexOf("<spell");
    const lastSpellClosing = normalizedText.lastIndexOf("</spell>");
    if (lastSpellOpening > lastSpellClosing) {
      return true;
    }

    return normalizedText.lastIndexOf("[laughter") > normalizedText.lastIndexOf("]");
  }

  private sanitizeMentorResponseDelta(text: string): string {
    const leadingWhitespace = text.match(/^\s*/)?.[0] ?? "";
    const trailingWhitespace = text.match(/\s*$/)?.[0] ?? "";
    const strippedText = stripVoiceControlTags(text);

    if (!strippedText) {
      return "";
    }

    return `${leadingWhitespace}${strippedText}${trailingWhitespace}`;
  }

  private sendMentorTextDeltaChunk(
    session: ExternalAudioSession,
    jobId: string,
    text: string,
    seq: number,
  ): number {
    session.socket.sendMentorTextDelta({
      type: "mentor.text.delta",
      seq,
      text,
      jobId,
    });

    return seq + 1;
  }

  private emitLearnerTranscription(
    sessionId: string,
    payload: LearnerTranscriptionEventPayload,
  ): void {
    this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.LEARNER_TRANSCRIPTION, sessionId, payload);
  }

  private emitMentorResponseDelta(
    sessionId: string,
    payload: MentorResponseDeltaEventPayload,
  ): void {
    if (!payload.text) {
      return;
    }

    this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.MENTOR_RESPONSE_DELTA, sessionId, payload);
  }

  private emitMentorResponseCompleted(
    sessionId: string,
    payload: MentorResponseCompletedEventPayload,
  ): void {
    this.realtimePublisher.emitToRoom(
      VOICE_SOCKET_EVENT.MENTOR_RESPONSE_COMPLETED,
      sessionId,
      payload,
    );
  }

  private async canAccessLesson(lessonId: UUIDType, currentUser: WsUser): Promise<boolean> {
    if (
      hasAnyPermission(currentUser.permissions, [
        PERMISSIONS.COURSE_UPDATE,
        PERMISSIONS.COURSE_UPDATE_OWN,
      ])
    ) {
      return true;
    }

    const [lessonAccess] = await this.aiRepository.checkLessonAssignment(
      lessonId,
      currentUser.userId,
    );

    if (!lessonAccess) {
      return false;
    }

    return Boolean(lessonAccess.isAssigned || lessonAccess.isFreemium);
  }

  private buildStartAudioPayload(
    payload: StartAudioBody,
    language: SupportedLanguages,
    voiceStartConfig: { preset?: AiMentorTTSPreset; customTtsReference?: string },
  ): StartAudioPayload {
    return {
      type: LUMA_SOCKET_MESSAGE_TYPES.AUDIO_START,
      audioAction: LUMA_AUDIO_ACTIONS.VOICE_MENTOR,
      language,
      ...(voiceStartConfig.preset ? { preset: voiceStartConfig.preset } : {}),
      ...(voiceStartConfig.customTtsReference
        ? { customTtsReference: voiceStartConfig.customTtsReference }
        : {}),
      meta: {
        sr: payload.meta.sr,
        channels: payload.meta.channels,
        format: LUMA_AUDIO_FORMATS.PCM_S16LE,
      },
      transcriptionMode: TRANSCRIPTION_MODES.REALTIME_STREAM,
    };
  }

  private resolveVoiceStartConfig(voiceConfig?: {
    voiceMode: string;
    ttsPreset: string;
    customTtsReference: string | null;
  }): { preset?: AiMentorTTSPreset; customTtsReference?: string } {
    const customTtsReference = voiceConfig?.customTtsReference?.trim() || null;
    const ttsPreset =
      voiceConfig?.ttsPreset === AI_MENTOR_TTS_PRESET.FEMALE
        ? AI_MENTOR_TTS_PRESET.FEMALE
        : AI_MENTOR_TTS_PRESET.MALE;

    if (voiceConfig?.voiceMode === AI_MENTOR_VOICE_MODE.CUSTOM && customTtsReference) {
      return { customTtsReference };
    }

    return { preset: ttsPreset };
  }

  private buildStopAudioPayload(): AudioStopPayload {
    return {
      type: LUMA_SOCKET_MESSAGE_TYPES.AUDIO_STOP,
    };
  }
}
