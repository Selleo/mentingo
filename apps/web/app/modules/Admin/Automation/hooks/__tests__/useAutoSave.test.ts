import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoSave } from "../useAutoSave";

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onSave after the default delay (400ms)", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutoSave(onSave));

    act(() => {
      result.current("payload-1");
    });

    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith("payload-1");
  });

  it("debounces multiple rapid triggers", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutoSave(onSave));

    act(() => {
      result.current("first");
      vi.advanceTimersByTime(200);
      result.current("second");
      vi.advanceTimersByTime(200);
      result.current("third");
    });

    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith("third");
  });

  it("supports custom delay", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutoSave(onSave, 1000));

    act(() => {
      result.current("data");
    });

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("uses the latest onSave callback", () => {
    const onSave1 = vi.fn();
    const onSave2 = vi.fn();
    const { result, rerender } = renderHook(({ fn }) => useAutoSave(fn), {
      initialProps: { fn: onSave1 },
    });

    act(() => {
      result.current("data");
    });

    rerender({ fn: onSave2 });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onSave1).not.toHaveBeenCalled();
    expect(onSave2).toHaveBeenCalledOnce();
    expect(onSave2).toHaveBeenCalledWith("data");
  });

  it("flushes the pending save on unmount", () => {
    const onSave = vi.fn();
    const { result, unmount } = renderHook(() => useAutoSave(onSave));

    act(() => {
      result.current("data");
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith("data");
  });
});
