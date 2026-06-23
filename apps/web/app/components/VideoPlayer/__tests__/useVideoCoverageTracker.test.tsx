import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncLessonVideoCompletionQueries, useLessonVideoProgress } from "~/api/mutations";

import { getVideoResumeTimeSeconds, useVideoCoverageTracker } from "../useVideoCoverageTracker";

import type { VideoCoverageRange } from "../videoCoverage.types";
import type videojs from "video.js";

vi.mock("~/api/mutations", () => ({
  syncLessonVideoCompletionQueries: vi.fn(),
  useLessonVideoProgress: vi.fn(),
}));

type VideoJSType = ReturnType<typeof videojs>;
type PlayerEvent = "timeupdate" | "play" | "pause" | "seeking" | "seeked" | "ended";

class FakeVideoPlayer {
  private listeners = new Map<PlayerEvent, Set<() => void>>();
  private videoTime = 0;
  private pausedValue = true;

  constructor(private readonly durationValue = 100) {}

  on(eventName: PlayerEvent, listener: () => void) {
    const listeners = this.listeners.get(eventName) ?? new Set();
    listeners.add(listener);
    this.listeners.set(eventName, listeners);
  }

  off(eventName: PlayerEvent, listener: () => void) {
    this.listeners.get(eventName)?.delete(listener);
  }

  emit(eventName: PlayerEvent) {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener();
    }
  }

  setCurrentTime(value: number) {
    this.videoTime = value;
  }

  setPaused(value: boolean) {
    this.pausedValue = value;
  }

  currentTime() {
    return this.videoTime;
  }

  duration() {
    return this.durationValue;
  }

  paused() {
    return this.pausedValue;
  }

  playbackRate() {
    return 1;
  }
}

const createProgressResponse = (watchedRanges: VideoCoverageRange[], durationSeconds = 100) => ({
  lessonId: "lesson-id",
  resourceEntityId: "resource-entity-id",
  durationSeconds,
  bucketSizeSeconds: 1,
  coveredBucketCount: watchedRanges.reduce((total, [start, end]) => total + end - start, 0),
  coveragePercent:
    watchedRanges.reduce((total, [start, end]) => total + end - start, 0) / durationSeconds,
  watchedRanges,
  isWatched: false,
  watchedAt: null,
  lessonCompleted: false,
});

describe("useVideoCoverageTracker", () => {
  const mutateAsync = vi.fn();
  const syncLessonCompletionQueries = vi.mocked(syncLessonVideoCompletionQueries);
  let now = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mutateAsync.mockImplementation((body: { watchedRanges: VideoCoverageRange[] }) =>
      Promise.resolve(createProgressResponse(body.watchedRanges)),
    );
    vi.mocked(useLessonVideoProgress).mockReturnValue({
      mutateAsync,
    } as never);
    syncLessonCompletionQueries.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flushes bucketed ranges after normal forward playback", async () => {
    const player = new FakeVideoPlayer();

    renderHook(() =>
      useVideoCoverageTracker(player as unknown as VideoJSType, {
        enabled: true,
        lessonId: "lesson-id",
        resourceEntityId: "resource-entity-id",
        language: "en",
        initialBucketSizeSeconds: 1,
      }),
    );

    act(() => {
      player.setPaused(false);
      player.setCurrentTime(0);
      player.emit("play");
      now = 5_000;
      player.setCurrentTime(4.6);
      player.emit("timeupdate");
      player.setPaused(true);
      player.emit("pause");
    });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      lessonId: "lesson-id",
      resourceEntityId: "resource-entity-id",
      durationSeconds: 100,
      bucketSize: 1,
      watchedRanges: [[0, 5]],
      activeWatchSecondsDelta: 4.6,
      language: "en",
    });
  });

  it("does not count skipped time when the player seeks", async () => {
    const player = new FakeVideoPlayer();

    renderHook(() =>
      useVideoCoverageTracker(player as unknown as VideoJSType, {
        enabled: true,
        lessonId: "lesson-id",
        resourceEntityId: "resource-entity-id",
        initialBucketSizeSeconds: 1,
      }),
    );

    act(() => {
      player.setPaused(false);
      player.setCurrentTime(0);
      player.emit("play");
      now = 100;
      player.emit("seeking");
      player.setCurrentTime(80);
      now = 200;
      player.emit("seeked");
      now = 5_200;
      player.setCurrentTime(85);
      player.emit("timeupdate");
      player.setPaused(true);
      player.emit("pause");
    });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedRanges: [[80, 85]],
        activeWatchSecondsDelta: 5,
      }),
    );
  });

  it("ignores impossible media jumps during timeupdate", async () => {
    const player = new FakeVideoPlayer();

    renderHook(() =>
      useVideoCoverageTracker(player as unknown as VideoJSType, {
        enabled: true,
        lessonId: "lesson-id",
        resourceEntityId: "resource-entity-id",
        initialBucketSizeSeconds: 1,
      }),
    );

    act(() => {
      player.setPaused(false);
      player.setCurrentTime(0);
      player.emit("play");
      now = 1_000;
      player.setCurrentTime(50);
      player.emit("timeupdate");
      player.setPaused(true);
      player.emit("pause");
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("defers completion query sync until playback stops", async () => {
    const player = new FakeVideoPlayer();
    mutateAsync.mockResolvedValue({
      ...createProgressResponse([[0, 95]]),
      isWatched: true,
      lessonCompleted: true,
    });

    const { result } = renderHook(() =>
      useVideoCoverageTracker(player as unknown as VideoJSType, {
        enabled: true,
        lessonId: "lesson-id",
        resourceEntityId: "resource-entity-id",
        initialBucketSizeSeconds: 1,
      }),
    );

    act(() => {
      player.setPaused(false);
      player.setCurrentTime(0);
      player.emit("play");
      now = 5_000;
      player.setCurrentTime(4.6);
      player.emit("timeupdate");
    });

    await act(async () => {
      await result.current.flush();
    });

    expect(syncLessonCompletionQueries).not.toHaveBeenCalled();

    act(() => {
      player.setPaused(true);
      player.emit("pause");
    });

    await waitFor(() => expect(syncLessonCompletionQueries).toHaveBeenCalledWith("lesson-id"));
  });
});

describe("getVideoResumeTimeSeconds", () => {
  it("returns the end of the first watched range when the video has an unwatched gap", () => {
    expect(
      getVideoResumeTimeSeconds({
        watchedRanges: [
          [0, 50],
          [60, 100],
        ],
        durationSeconds: 100,
        isWatched: false,
      }),
    ).toBe(50);
  });

  it("starts from the beginning when the first watched range reaches the end", () => {
    expect(
      getVideoResumeTimeSeconds({
        watchedRanges: [[0, 100]],
        durationSeconds: 100,
        isWatched: false,
      }),
    ).toBe(0);
  });

  it("starts from the beginning when the video is already watched", () => {
    expect(
      getVideoResumeTimeSeconds({
        watchedRanges: [[0, 50]],
        durationSeconds: 100,
        isWatched: true,
      }),
    ).toBe(0);
  });

  it("starts from the beginning when there are no watched ranges", () => {
    expect(
      getVideoResumeTimeSeconds({
        watchedRanges: [],
        durationSeconds: 100,
        isWatched: false,
      }),
    ).toBe(0);
  });
});
