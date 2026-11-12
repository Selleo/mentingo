import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatQuizTimeLeft, useQuizCountdown } from "../useQuizCountdown";

const DEVICE_NOW = new Date("2026-01-01T10:00:00.000Z");

const isoFromDevice = (offsetSeconds: number) =>
  new Date(DEVICE_NOW.getTime() + offsetSeconds * 1000).toISOString();

describe("useQuizCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DEVICE_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("measures remaining time with the server clock, not the device clock", () => {
    // device clock is 5 minutes ahead of the server
    const serverNow = isoFromDevice(-300);
    const expiresAt = isoFromDevice(-300 + 120);

    const { result } = renderHook(() =>
      useQuizCountdown({ expiresAt, serverNow, onExpire: vi.fn() }),
    );

    expect(result.current.secondsLeft).toBe(120);
    expect(result.current.isWarning).toBe(false);
  });

  it("pairs a cached serverNow with the time it was received", () => {
    // fetched 100 s ago with 200 s left: 100 s remain now
    const { result } = renderHook(() =>
      useQuizCountdown({
        expiresAt: isoFromDevice(100),
        serverNow: isoFromDevice(-100),
        receivedAt: DEVICE_NOW.getTime() - 100_000,
        onExpire: vi.fn(),
      }),
    );

    expect(result.current.secondsLeft).toBe(100);
  });

  it("warns during the last minute and expires exactly once", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() =>
      useQuizCountdown({ expiresAt: isoFromDevice(61), serverNow: isoFromDevice(0), onExpire }),
    );

    expect(result.current.isWarning).toBe(false);

    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.secondsLeft).toBe(60);
    expect(result.current.isWarning).toBe(true);
    expect(onExpire).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.secondsLeft).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("reports the end of the submit grace period", () => {
    const { result } = renderHook(() =>
      useQuizCountdown({
        expiresAt: isoFromDevice(1),
        serverNow: isoFromDevice(0),
        graceSeconds: 30,
        onExpire: vi.fn(),
      }),
    );

    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isGraceOver).toBe(false);

    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.isGraceOver).toBe(true);
  });

  it("expires immediately for a deadline that already passed and not again on a refetch", () => {
    const onExpire = vi.fn();
    const expiresAt = isoFromDevice(-10);
    const { rerender } = renderHook(
      ({ serverNow }) => useQuizCountdown({ expiresAt, serverNow, onExpire }),
      { initialProps: { serverNow: isoFromDevice(0) } },
    );

    expect(onExpire).toHaveBeenCalledTimes(1);

    rerender({ serverNow: isoFromDevice(1) });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("does not count down without an attempt", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useQuizCountdown({ onExpire }));

    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.secondsLeft).toBeNull();
    expect(onExpire).not.toHaveBeenCalled();
  });
});

describe("formatQuizTimeLeft", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatQuizTimeLeft(0)).toBe("00:00");
    expect(formatQuizTimeLeft(65)).toBe("01:05");
    expect(formatQuizTimeLeft(600 * 60)).toBe("600:00");
  });
});
