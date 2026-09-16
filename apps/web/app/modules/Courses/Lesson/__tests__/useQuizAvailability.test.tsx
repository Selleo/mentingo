import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuizAvailability } from "../useQuizAvailability";

const opening = "2026-09-15T12:00:00Z";

describe("scheduled quiz availability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T11:59:58Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("counts down and unlocks at the opening time without a reload", () => {
    const { result } = renderHook(() => useQuizAvailability(opening));
    expect(result.current.openingSecondsLeft).toBe(2);
    expect(result.current.isUnavailable).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.openingSecondsLeft).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.openingSecondsLeft).toBe(0);
    expect(result.current.isBeforeOpening).toBe(false);
    expect(result.current.isUnavailable).toBe(false);
  });

  it("refreshes when returning to a suspended tab and respects the closing time", () => {
    const { result, unmount } = renderHook(() =>
      useQuizAvailability(opening, "2026-09-15T13:00:00Z"),
    );
    act(() => {
      vi.setSystemTime(new Date("2026-09-15T12:30:00Z"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(result.current.isUnavailable).toBe(false);
    act(() => {
      vi.setSystemTime(new Date("2026-09-15T13:00:00Z"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.isUnavailable).toBe(true);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
