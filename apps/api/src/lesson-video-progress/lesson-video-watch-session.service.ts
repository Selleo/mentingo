import { Inject, Injectable } from "@nestjs/common";

import { REDIS_CLIENT, type RedisClient } from "src/redis";

import {
  MAX_VIDEO_TRACKING_PLAYBACK_RATE,
  VIDEO_TRACKING_FIRST_FLUSH_MAX_SECONDS,
  VIDEO_TRACKING_TOLERANCE_SECONDS,
  VIDEO_WATCH_SESSION_TTL_SECONDS,
} from "./lesson-video-progress.constants";
import { getLessonVideoWatchSessionKey } from "./utils/lesson-video-progress-cache-keys";

import type {
  AddAcceptedWatchSecondsParams,
  GetAllowedNewBucketCountParams,
  WatchSession,
} from "./lesson-video-progress.types";

@Injectable()
export class LessonVideoWatchSessionService {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: RedisClient) {}

  async getAllowedNewBucketCount({
    studentId,
    lessonId,
    resourceEntityId,
    durationSeconds,
    bucketSizeSeconds,
    activeWatchSecondsDelta,
  }: GetAllowedNewBucketCountParams) {
    const now = Date.now();
    const key = getLessonVideoWatchSessionKey({ studentId, lessonId, resourceEntityId });
    const session = await this.getSession(key);

    const elapsedSeconds = session
      ? Math.max(0, (now - session.lastFlushAt) / 1000)
      : Math.min(activeWatchSecondsDelta, VIDEO_TRACKING_FIRST_FLUSH_MAX_SECONDS);

    const allowedSeconds =
      elapsedSeconds * MAX_VIDEO_TRACKING_PLAYBACK_RATE + VIDEO_TRACKING_TOLERANCE_SECONDS;

    await this.setSession(key, {
      lastFlushAt: now,
      acceptedWatchSeconds: session?.acceptedWatchSeconds ?? 0,
      durationSeconds,
      bucketSizeSeconds,
    });

    return Math.max(0, Math.ceil(allowedSeconds / bucketSizeSeconds));
  }

  async addAcceptedWatchSeconds({
    studentId,
    lessonId,
    resourceEntityId,
    durationSeconds,
    bucketSizeSeconds,
    acceptedBucketCount,
  }: AddAcceptedWatchSecondsParams) {
    const key = getLessonVideoWatchSessionKey({ studentId, lessonId, resourceEntityId });
    const session = await this.getSession(key);

    await this.setSession(key, {
      lastFlushAt: Date.now(),
      acceptedWatchSeconds:
        (session?.acceptedWatchSeconds ?? 0) + acceptedBucketCount * bucketSizeSeconds,
      durationSeconds,
      bucketSizeSeconds,
    });
  }

  private async getSession(key: string): Promise<WatchSession | null> {
    const rawSession = await this.redisClient.get(key);
    if (!rawSession) return null;

    try {
      return JSON.parse(rawSession) as WatchSession;
    } catch {
      return null;
    }
  }

  private async setSession(key: string, session: WatchSession) {
    await this.redisClient.setEx(key, VIDEO_WATCH_SESSION_TTL_SECONDS, JSON.stringify(session));
  }
}
