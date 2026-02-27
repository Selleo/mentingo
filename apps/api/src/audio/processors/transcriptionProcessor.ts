import { Inject, Injectable, Logger } from "@nestjs/common";
import { VOICE_ACTION } from "@repo/shared";
import { commandOptions } from "redis";

import { AiService } from "src/ai/services/ai.service";
import {
  AUDIO_EXPIRE,
  getAudioDataKey,
  getAudioMetaKey,
  getAudioTranscriptKey,
  REDIS_AUDIO_SUBSCRIBER_CHANNEL,
} from "src/audio/constants/audio.constants";
import { pcm16leToWav } from "src/audio/utils/pcm-to-wav.util";
import { REDIS_CLIENT, RedisClient } from "src/redis";

import type { AudioProcessor, StopAudioMessage } from "../types/audio.types";

@Injectable()
export class TranscriptionProcessor implements AudioProcessor {
  public name = VOICE_ACTION.TRANSCRIPT;
  private readonly logger = new Logger(TranscriptionProcessor.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient,
    private readonly aiService: AiService,
  ) {}

  async run(payload: StopAudioMessage) {
    const audioRaw = await this.redisClient.get(
      commandOptions({ returnBuffers: true }),
      getAudioDataKey(payload.clientId),
    );
    if (!audioRaw) {
      await this.publishResult(payload);
      return;
    }

    const audio = Buffer.isBuffer(audioRaw) ? audioRaw : Buffer.from(audioRaw, "binary");
    const sampleRate =
      Number(await this.redisClient.HGET(getAudioMetaKey(payload.clientId), "sr")) || 16000;
    const channels =
      Number(await this.redisClient.HGET(getAudioMetaKey(payload.clientId), "channels")) || 1;
    const format = await this.redisClient.HGET(getAudioMetaKey(payload.clientId), "format");
    const transcriptionInput =
      format === "pcm_s16le" ? pcm16leToWav({ pcm: audio, sampleRate, channels }) : audio;

    try {
      const transcription = await this.aiService.transcribe(payload.clientId, transcriptionInput);
      await this.redisClient.setEx(
        getAudioTranscriptKey(payload.clientId),
        AUDIO_EXPIRE,
        transcription?.text ?? "",
      );
    } catch (error) {
      this.logger.error("Transcription failed", error);
      throw error;
    } finally {
      await this.publishResult(payload);
    }
  }

  private async publishResult(payload: StopAudioMessage) {
    await this.redisClient.publish(REDIS_AUDIO_SUBSCRIBER_CHANNEL, JSON.stringify(payload));
  }
}
