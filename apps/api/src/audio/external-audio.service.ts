import {
  createLumaSocket,
  LUMA_AUDIO_ACTIONS,
  LUMA_AUDIO_FORMATS,
  LUMA_SOCKET_MESSAGE_TYPES,
  type AudioChunkPayload,
  type AudioStartedPayload,
  type AudioOutputErrorPayload,
  type AudioOutputCompletePayload,
  type AudioOutputInterruptedPayload,
  type AudioStopPayload,
  type ClientSpeechBoundaryPayload as LumaClientSpeechBoundaryPayload,
  type MentorTranscriptionPayload,
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
  ClientSpeechBoundaryPayload,
  MentorResponseDeltaEventPayload,
  MentorResponseCompletedEventPayload,
  MentorTranscriptionEventPayload,
  PcmChunkMeta,
  SupportedLanguages,
} from "@repo/shared";
import type { AiVoiceDeliveryContext } from "src/ai/ai-chat.types";
import type { SendTTSTriggerBody, StartAudioBody } from "src/audio/types/audio.types";
import type { ExternalAudioSession } from "src/audio/types/external-audio-session.types";
import type { ExternalAudioStartResult } from "src/audio/types/external-audio.types";
import type { UUIDType } from "src/common";
import type { WsUser } from "src/websocket/websocket.types";

type VoiceMentorSocketHandlers = {
  disconnect: () => void;
  audioStarted: (payload: AudioStartedPayload) => void;
  mentorTranscription: (payload: MentorTranscriptionPayload) => Promise<void>;
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

    session.socket.sendAudioChunk(audioChunkPayload, bytes);
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
    session.socket.sendClientSpeechStart(boundary);
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
    session.socket.sendClientSpeechEnd(boundary);
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
      activeTurnId: null,
      audioOutputErrors: new Map(),
      pendingInterruption: false,
      interruptedTurnIds: new Set(),
      activeMentorStream: null,
    };

    this.registerVoiceMentorHandlers(session);

    socket.connect();
    socket.startAudio(this.buildStartAudioPayload(payload, lessonLanguage, voiceStartConfig));

    this.sessionStore.set(session);
    return { ok: true };
  }

  private registerVoiceMentorHandlers(session: ExternalAudioSession): void {
    const { socket } = session;
    const handlers = this.createVoiceMentorSocketHandlers(session);

    socket.on("disconnect", handlers.disconnect);
    socket.onMentorTranscription(handlers.mentorTranscription);
    socket.onAudioOutputChunk(handlers.audioOutputChunk);
    socket.onAudioOutputInterrupted(handlers.audioOutputInterrupted);
    socket.onAudioOutputError(handlers.audioOutputError);
    socket.onAudioOutputComplete(handlers.audioOutputComplete);
    socket.onAudioStarted(handlers.audioStarted);
  }

  private createVoiceMentorSocketHandlers(
    session: ExternalAudioSession,
  ): VoiceMentorSocketHandlers {
    const { sessionId } = session;

    return {
      disconnect: () => {
        this.sessionStore.delete(sessionId);
      },
      audioStarted: (payload) => {
        this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.AUDIO_STARTED, sessionId, payload);
      },
      mentorTranscription: async (payload) => {
        await this.handleMentorTranscription(sessionId, payload);
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
        this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.AUDIO_SPEECH, sessionId, nextPayload);
      },
      audioOutputInterrupted: (payload) => {
        const interruptedTurnId =
          session.activeTurnId && payload.jobId === session.activeTurnId
            ? session.activeTurnId
            : null;
        const nextPayload = {
          turnId: interruptedTurnId ?? undefined,
        };
        this.realtimePublisher.emitToRoom(
          VOICE_SOCKET_EVENT.AUDIO_INTERRUPTED,
          sessionId,
          nextPayload,
        );
        if (interruptedTurnId) {
          session.pendingInterruption = true;
          if (session.activeMentorStream?.turnId === interruptedTurnId) {
            session.interruptedTurnIds.add(interruptedTurnId);
            session.activeMentorStream.abortController.abort("MENTOR_RESPONSE_INTERRUPTED");
          }
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
          `Luma audio output failed for mentor turn ${payload.jobId} in session ${sessionId}: ${payload.data.code}`,
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
          sessionId,
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

  private async handleMentorTranscription(
    sessionId: string,
    payload: MentorTranscriptionPayload,
  ): Promise<void> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return;
    }

    const text = payload.data.text?.trim();
    if (!text) {
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

    this.emitMentorTranscription(sessionId, {
      text,
      jobId: payload.jobId,
    });

    let shouldForwardMentorText = true;
    let stoppedByAudioOutputError = false;
    try {
      await this.tenantDbRunner.runWithTenant(session.currentUser.tenantId, async () => {
        const stream = await this.aiService.streamMessage(
          {
            threadId: session.threadId,
            content: text,
            voiceSessionId: sessionId,
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
    timing: MentorTranscriptionPayload["data"]["timing"],
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

  private emitMentorTranscription(
    sessionId: string,
    payload: MentorTranscriptionEventPayload,
  ): void {
    this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.MENTOR_TRANSCRIPTION, sessionId, payload);
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
