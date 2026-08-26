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
  private readonly element = document.createElement("div");
  private listeners = new Map<PlayerEvent, Set<() => void>>();
  private videoTime = 0;
  private pausedValue = true;

  constructor(private readonly durationValue = 100) {
    document.body.appendChild(this.element);
  }

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

  el() {
    return this.element;
  }

  isDisposed() {
    return false;
  }

  disconnect() {
    this.element.remove();
  }

  pause() {
    this.pausedValue = true;
    this.emit("pause");
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
    document.body.replaceChildren();
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

  it("stops collecting coverage immediately when a pause event fires", async () => {
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
      now = 5_000;
      player.setCurrentTime(4.6);
      player.emit("timeupdate");

      // Some video providers update their paused state after emitting pause.
      player.emit("pause");
      now = 8_000;
      player.setCurrentTime(7.6);
      player.emit("timeupdate");
    });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedRanges: [[0, 5]],
        activeWatchSecondsDelta: 4.6,
      }),
    );
  });

  it("does not collect coverage when the player is paused without emitting a pause event", async () => {
    const player = new FakeVideoPlayer();

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

      player.setPaused(true);
      now = 8_000;
      player.setCurrentTime(7.6);
      player.emit("timeupdate");
    });

    await act(async () => {
      await result.current.flush();
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedRanges: [[0, 5]],
        activeWatchSecondsDelta: 4.6,
      }),
    );
  });

  it("stops a detached player before it can collect background coverage", async () => {
    const player = new FakeVideoPlayer();

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

      player.disconnect();
      now = 8_000;
      player.setCurrentTime(7.6);
      player.emit("timeupdate");
    });

    await act(async () => {
      await result.current.flush();
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        watchedRanges: [[0, 5]],
        activeWatchSecondsDelta: 4.6,
      }),
    );
  });

  it("flushes progress collected after resuming when the previous pause save is in flight", async () => {
    const player = new FakeVideoPlayer();
    let resolveFirstSave: ((value: ReturnType<typeof createProgressResponse>) => void) | undefined;

    mutateAsync
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstSave = resolve;
          }),
      )
      .mockImplementationOnce((body: { watchedRanges: VideoCoverageRange[] }) =>
        Promise.resolve(createProgressResponse(body.watchedRanges)),
      );

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
      player.setPaused(true);
      player.emit("pause");
    });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    act(() => {
      player.setPaused(false);
      player.setCurrentTime(5);
      player.emit("play");
      now = 7_000;
      player.setCurrentTime(7);
      player.emit("timeupdate");
      player.setPaused(true);
      player.emit("pause");
    });

    await act(async () => {
      resolveFirstSave?.(createProgressResponse([[0, 5]]));
    });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        watchedRanges: [[5, 7]],
        activeWatchSecondsDelta: 2,
      }),
    );
    expect(result.current.snapshot.watchedRanges).toEqual([[0, 7]]);
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

  it("uses the backend duration instead of the player duration for coverage", async () => {
    const player = new FakeVideoPlayer();

    renderHook(() =>
      useVideoCoverageTracker(player as unknown as VideoJSType, {
        enabled: true,
        lessonId: "lesson-id",
        resourceEntityId: "resource-entity-id",
        initialDurationSeconds: 60,
        initialBucketSizeSeconds: 1,
      }),
    );

    act(() => {
      player.setPaused(false);
      player.setCurrentTime(0);
      player.emit("play");
      now = 5_000;
      player.setCurrentTime(5);
      player.emit("timeupdate");
      player.setPaused(true);
      player.emit("pause");
    });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        durationSeconds: 60,
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

  it("syncs completion queries as soon as a flush completes the lesson", async () => {
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

    expect(syncLessonCompletionQueries).toHaveBeenCalledWith("lesson-id");
  });

  it("reports snapshot changes for the tracked resource", async () => {
    const player = new FakeVideoPlayer();
    const onSnapshotChange = vi.fn();

    renderHook(() =>
      useVideoCoverageTracker(player as unknown as VideoJSType, {
        enabled: true,
        lessonId: "lesson-id",
        resourceEntityId: "resource-entity-id",
        initialBucketSizeSeconds: 1,
        onSnapshotChange,
      }),
    );

    await waitFor(() =>
      expect(onSnapshotChange).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceEntityId: "resource-entity-id",
          snapshot: expect.objectContaining({
            coveragePercent: 0,
            watchedRanges: [],
          }),
        }),
      ),
    );

    act(() => {
      player.setPaused(false);
      player.setCurrentTime(0);
      player.emit("play");
      now = 5_000;
      player.setCurrentTime(4.6);
      player.emit("timeupdate");
    });

    await waitFor(() =>
      expect(onSnapshotChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          resourceEntityId: "resource-entity-id",
          snapshot: expect.objectContaining({
            coveragePercent: 0.05,
            watchedRanges: [[0, 5]],
          }),
        }),
      ),
    );
  });

  it("keeps live progress when rerendered with equivalent initial watched ranges", async () => {
    const player = new FakeVideoPlayer();

    const { result, rerender } = renderHook(
      ({ initialWatchedRanges }: { initialWatchedRanges: VideoCoverageRange[] }) =>
        useVideoCoverageTracker(player as unknown as VideoJSType, {
          enabled: true,
          lessonId: "lesson-id",
          resourceEntityId: "resource-entity-id",
          initialCoveragePercent: 0.1,
          initialWatchedRanges,
          initialDurationSeconds: 100,
          initialBucketSizeSeconds: 1,
        }),
      {
        initialProps: {
          initialWatchedRanges: [[0, 10]],
        },
      },
    );

    act(() => {
      player.setPaused(false);
      player.setCurrentTime(10);
      player.emit("play");
      now = 15_000;
      player.setCurrentTime(15);
      player.emit("timeupdate");
    });

    await waitFor(() => expect(result.current.snapshot.watchedRanges).toEqual([[0, 15]]));

    rerender({
      initialWatchedRanges: [[0, 10]],
    });

    expect(result.current.snapshot.watchedRanges).toEqual([[0, 15]]);
    expect(result.current.snapshot.coveragePercent).toBe(0.15);
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
