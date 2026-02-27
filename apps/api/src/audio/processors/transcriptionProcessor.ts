import { Inject, Injectable } from "@nestjs/common";
import { VOICE_ACTION } from "@repo/shared";

import { AiService } from "src/ai/services/ai.service";
import {
  AUDIO_EXPIRE,
  getAudioDataKey,
  getAudioTranscriptKey,
  REDIS_AUDIO_SUBSCRIBER_CHANNEL,
} from "src/audio/constants/audio.constants";
import { REDIS_CLIENT, RedisClient } from "src/redis";

import type { AudioProcessor, StopAudioMessage } from "../types/audio.types";

@Injectable()
export class TranscriptionProcessor implements AudioProcessor {
  public name = VOICE_ACTION.TRANSCRIPT;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient,
    private readonly aiService: AiService,
  ) {}

  async run(payload: StopAudioMessage) {
    const audioRaw = await this.redisClient.get(getAudioDataKey(payload.clientId));
    if (!audioRaw) {
      await this.publishResult(payload);
      return;
    }

    const audio = Buffer.from(audioRaw, "binary");

    try {
      const transcription = await this.aiService.transcribe(payload.clientId, audio);
      await this.redisClient.setEx(
        getAudioTranscriptKey(payload.clientId),
        AUDIO_EXPIRE,
        transcription?.text ?? "",
      );
    } finally {
      await this.publishResult(payload);
    }
  }

  private async publishResult(payload: StopAudioMessage) {
    await this.redisClient.publish(REDIS_AUDIO_SUBSCRIBER_CHANNEL, JSON.stringify(payload));
  }
}
