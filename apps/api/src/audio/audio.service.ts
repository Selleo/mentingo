import { Inject, Injectable } from "@nestjs/common";
import { VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";
import { match } from "ts-pattern";

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

import type { OnModuleInit } from "@nestjs/common";
import type { PcmChunkMeta } from "@repo/shared";
import type { StartAudioBody, StopAudioMessage } from "src/audio/types/audio.types";

@Injectable()
export class AudioService implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient,
    @Inject(REDIS_EVENTS_SUBSCRIBER_CLIENT) private readonly redisSubscriber: RedisClient,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher,
  ) {}

  async onModuleInit() {
    await this.setupRedisSubscriber();
  }

  async startAudio(clientId: string, payload: StartAudioBody) {
    await this.redisClient.HSET(getAudioMetaKey(clientId), {
      ...payload.meta,
      voiceAction: payload.voiceAction,
    });

    await this.redisClient.expire(getAudioMetaKey(clientId), AUDIO_EXPIRE);
    await this.redisClient.del(getAudioDataKey(clientId));
  }

  async audioChunk(clientId: string, meta: PcmChunkMeta, bytes: Buffer) {
    const last_seq =
      Number(await this.redisClient.HGET(getAudioMetaKey(clientId), "last_seq")) || -1;
    if (meta.seq < last_seq) {
      return false;
    }

    await this.redisClient.append(getAudioDataKey(clientId), bytes);
    await this.redisClient.HSET(getAudioMetaKey(clientId), "last_seq", meta.seq);
    await this.redisClient.expire(getAudioDataKey(clientId), AUDIO_EXPIRE);

    return true;
  }

  async stopAudio(clientId: string) {
    const voiceAction = await this.getVoiceAction(clientId);
    if (!voiceAction) {
      this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.STOP_AUDIO, clientId, {
        error: "Missing voiceAction",
      });
      return;
    }

    await this.queueService.enqueue(QUEUE_NAMES.AUDIO, voiceAction, { clientId });
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
          });
        })
        .otherwise(async () => {
          this.realtimePublisher.emitToRoom(VOICE_SOCKET_EVENT.STOP_AUDIO, data.clientId, {
            error: "Unsupported voiceAction",
          });
        });

      await this.redisClient.del(getAudioDataKey(data.clientId));
      await this.redisClient.del(getAudioMetaKey(data.clientId));
      await this.redisClient.del(getAudioTranscriptKey(data.clientId));
    });
  }

  private async getVoiceAction(clientId: string) {
    return this.redisClient.HGET(getAudioMetaKey(clientId), "voiceAction");
  }

  private parseMessage(message: string) {
    try {
      return JSON.parse(message) as StopAudioMessage;
    } catch {
      return undefined;
    }
  }
}
