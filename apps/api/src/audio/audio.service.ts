import { Inject, Injectable, Logger } from "@nestjs/common";
import { VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";
import { match } from "ts-pattern";

import {
  SUPPORTED_EXTERNAL_VOICE_ACTIONS,
  SUPPORTED_INTERNAL_VOICE_ACTIONS,
} from "src/audio/constants/audio-actions.constants";
import {
  AUDIO_EXPIRE,
  getAudioDataKey,
  getAudioMetaKey,
  getAudioTranscriptKey,
  REDIS_AUDIO_SUBSCRIBER_CHANNEL,
} from "src/audio/constants/audio.constants";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { REDIS_CLIENT, REDIS_EVENTS_SUBSCRIBER_CLIENT, type RedisClient } from "src/redis";
import { REALTIME_PUBLISHER, type RealtimePublisher } from "src/websocket/realtime.publisher";

import { ExternalAudioService } from "./external-audio.service";

import type { OnModuleInit } from "@nestjs/common";
import type { PcmChunkMeta, VoiceAction } from "@repo/shared";
import type { StartAudioBody, StopAudioMessage } from "src/audio/types/audio.types";
import type { WsUser } from "src/websocket/websocket.types";

@Injectable()
export class AudioService implements OnModuleInit {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly externalAudioService: ExternalAudioService,
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient,
    @Inject(REDIS_EVENTS_SUBSCRIBER_CLIENT) private readonly redisSubscriber: RedisClient,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher,
  ) {}

  onModuleInit() {
    void this.setupRedisSubscriber().catch((error) => {
      this.logger.error("Failed to setup audio redis subscriber", error);
    });
  }

  async startAudio(sessionId: string, currentUser: WsUser, payload: StartAudioBody) {
    if (!payload?.voiceAction || !payload?.meta) {
      this.logger.warn(`Invalid startAudio payload for session ${sessionId}`);
      return;
    }

    const isSupportedExternalAction = SUPPORTED_EXTERNAL_VOICE_ACTIONS.some(
      (action) => action === payload.voiceAction,
    );
    const isSupportedInternalAction = SUPPORTED_INTERNAL_VOICE_ACTIONS.some(
      (action) => action === payload.voiceAction,
    );

    if (!isSupportedExternalAction && !isSupportedInternalAction) {
      this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.STOP_AUDIO, sessionId, {
        error: "Unsupported action",
        voiceAction: payload.voiceAction,
      });
      return;
    }

    await this.redisClient.HSET(getAudioMetaKey(sessionId), {
      ...payload.meta,
      voiceAction: payload.voiceAction,
    });

    await this.redisClient.expire(getAudioMetaKey(sessionId), AUDIO_EXPIRE);
    await this.redisClient.del(getAudioDataKey(sessionId));

    if (isSupportedExternalAction) {
      const externalStart = await this.externalAudioService.startAudio(
        sessionId,
        currentUser,
        payload,
      );
      if (!externalStart.ok) {
        this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.STOP_AUDIO, sessionId, {
          translationKey: externalStart.translationKey,
          voiceAction: payload.voiceAction,
        });
      }
    }
  }

  async audioChunk(sessionId: string, meta: PcmChunkMeta, bytes: Buffer) {
    const voiceAction = await this.getVoiceAction(sessionId);
    if (this.isExternalVoiceAction(voiceAction)) {
      return this.externalAudioService.audioChunk(sessionId, meta, bytes);
    }

    const last_seq =
      Number(await this.redisClient.HGET(getAudioMetaKey(sessionId), "last_seq")) || -1;
    if (meta.seq < last_seq) {
      return false;
    }

    await this.redisClient.append(getAudioDataKey(sessionId), bytes);
    await this.redisClient.HSET(getAudioMetaKey(sessionId), "last_seq", meta.seq);
    await this.redisClient.expire(getAudioDataKey(sessionId), AUDIO_EXPIRE);

    return true;
  }

  async stopAudio(sessionId: string) {
    const voiceAction = await this.getVoiceAction(sessionId);
    if (!voiceAction) {
      this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.STOP_AUDIO, sessionId, {
        error: "Missing voiceAction",
        voiceAction: null,
      });
      return;
    }

    if (this.isExternalVoiceAction(voiceAction)) {
      await this.externalAudioService.stopAudio(sessionId);
      return;
    }

    await this.queueService.enqueue(QUEUE_NAMES.AUDIO, voiceAction, { clientId: sessionId });
  }

  async cancelAudio(sessionId: string) {
    const voiceAction = await this.getVoiceAction(sessionId);
    if (this.isExternalVoiceAction(voiceAction)) {
      await this.externalAudioService.cancelAudio(sessionId);
    }

    await this.clearAudioState(sessionId);
    this.realtimePublisher.emitToRoom("voice:sessionMetadataCleared", sessionId, {
      clientId: sessionId,
    });
  }

  async handleDisconnect(sessionId: string) {
    this.externalAudioService.clearSession(sessionId);
    await this.clearAudioState(sessionId);
  }

  private async setupRedisSubscriber() {
    await this.redisSubscriber.subscribe(REDIS_AUDIO_SUBSCRIBER_CHANNEL, async (message) => {
      const data = this.parseMessage(message);
      if (!data?.clientId) return;

      const voiceAction = await this.getVoiceAction(data.clientId);

      await match(voiceAction)
        .with(VOICE_ACTION.TRANSCRIPT, async () => {
          const transcript = await this.redisClient.get(getAudioTranscriptKey(data.clientId));
          this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.STOP_AUDIO, data.clientId, {
            payload: transcript ?? undefined,
            voiceAction,
          });
        })
        .otherwise(async () => {
          this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.STOP_AUDIO, data.clientId, {
            error: "Unsupported voiceAction",
            voiceAction: voiceAction ?? null,
          });
        });

      await this.clearAudioState(data.clientId);
    });
  }

  private async clearAudioState(clientId: string) {
    await this.redisClient.del(getAudioDataKey(clientId));
    await this.redisClient.del(getAudioMetaKey(clientId));
    await this.redisClient.del(getAudioTranscriptKey(clientId));
  }

  private async getVoiceAction(sessionId: string) {
    return this.redisClient.HGET(getAudioMetaKey(sessionId), "voiceAction");
  }

  isExternalVoiceAction(voiceAction: string | null | undefined): voiceAction is VoiceAction {
    return SUPPORTED_EXTERNAL_VOICE_ACTIONS.some((action) => action === voiceAction);
  }

  private parseMessage(message: string) {
    try {
      return JSON.parse(message) as StopAudioMessage;
    } catch {
      return undefined;
    }
  }
}
