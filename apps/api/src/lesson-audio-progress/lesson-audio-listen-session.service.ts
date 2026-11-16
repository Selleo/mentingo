import { Inject, Injectable } from "@nestjs/common";

import { REDIS_CLIENT, type RedisClient } from "src/redis";

import {
  AUDIO_LISTEN_SESSION_TTL_SECONDS,
  AUDIO_TRACKING_FIRST_FLUSH_MAX_SECONDS,
  AUDIO_TRACKING_TOLERANCE_SECONDS,
  MAX_AUDIO_TRACKING_PLAYBACK_RATE,
} from "./lesson-audio-progress.constants";
import { getLessonAudioListenSessionKey } from "./utils/lesson-audio-progress-cache-keys";

import type {
  AddAcceptedListenSecondsParams,
  GetAllowedNewListenedBucketCountParams,
  ListenSession,
} from "./lesson-audio-progress.types";

@Injectable()
export class LessonAudioListenSessionService {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: RedisClient) {}

  async getAllowedNewBucketCount({
    studentId,
    lessonId,
    resourceEntityId,
    durationSeconds,
    bucketSizeSeconds,
    activeListenSecondsDelta,
  }: GetAllowedNewListenedBucketCountParams) {
    const now = Date.now();
    const key = getLessonAudioListenSessionKey({ studentId, lessonId, resourceEntityId });
    const session = await this.getSession(key);

    const elapsedSeconds = session
      ? Math.max(0, (now - session.lastFlushAt) / 1000)
      : Math.min(activeListenSecondsDelta, AUDIO_TRACKING_FIRST_FLUSH_MAX_SECONDS);

    const allowedSeconds =
      elapsedSeconds * MAX_AUDIO_TRACKING_PLAYBACK_RATE + AUDIO_TRACKING_TOLERANCE_SECONDS;

    await this.setSession(key, {
      lastFlushAt: now,
      acceptedListenSeconds: session?.acceptedListenSeconds ?? 0,
      durationSeconds,
      bucketSizeSeconds,
    });

    return Math.max(0, Math.ceil(allowedSeconds / bucketSizeSeconds));
  }

  async addAcceptedListenSeconds({
    studentId,
    lessonId,
    resourceEntityId,
    durationSeconds,
    bucketSizeSeconds,
    acceptedBucketCount,
  }: AddAcceptedListenSecondsParams) {
    const key = getLessonAudioListenSessionKey({ studentId, lessonId, resourceEntityId });
    const session = await this.getSession(key);

    await this.setSession(key, {
      lastFlushAt: Date.now(),
      acceptedListenSeconds:
        (session?.acceptedListenSeconds ?? 0) + acceptedBucketCount * bucketSizeSeconds,
      durationSeconds,
      bucketSizeSeconds,
    });
  }

  private async getSession(key: string): Promise<ListenSession | null> {
    const rawSession = await this.redisClient.get(key);
    if (!rawSession) return null;

    try {
      return JSON.parse(rawSession) as ListenSession;
    } catch {
      return null;
    }
  }

  private async setSession(key: string, session: ListenSession) {
    await this.redisClient.setEx(key, AUDIO_LISTEN_SESSION_TTL_SECONDS, JSON.stringify(session));
  }
}
