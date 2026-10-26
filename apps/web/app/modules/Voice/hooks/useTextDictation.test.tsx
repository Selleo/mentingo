import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DICTATION_PHASES } from "../dictation.constants";

import { useTextDictation } from "./useTextDictation";

const transport = vi.hoisted(() => ({
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  cancelTranscription: vi.fn(),
  setInput: null as ((next: string | ((current: string) => string)) => void) | null,
}));
vi.mock("./useTranscription", () => ({
  useTranscription: ({ setInput }: { setInput: typeof transport.setInput }) => {
    transport.setInput = setInput;
    return transport;
  },
}));
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const deliver = (text: string) => act(() => transport.setInput?.((current) => current + text));
beforeEach(() => {
  transport.startRecording.mockReset().mockResolvedValue(true);
  transport.stopRecording.mockReset().mockResolvedValue(undefined);
  transport.cancelTranscription.mockReset().mockResolvedValue(undefined);
  transport.setInput = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("shared text dictation lifecycle", () => {
  it.each(["before", "after"])(
    "waits for both final text and stop completion when text arrives %s stop settles",
    async (ordering) => {
      const stopped = deferred<void>();
      transport.stopRecording.mockReturnValue(stopped.promise);
      const onChange = vi.fn();
      const { result } = renderHook(() => useTextDictation({ value: "Typed ", onChange }));
      await act(async () => result.current.start());
      let stop!: Promise<void>;
      act(() => {
        stop = result.current.stop();
      });
      expect(result.current.phase).toBe(DICTATION_PHASES.TRANSCRIBING);
      if (ordering === "before") deliver("dictation");
      await act(async () => {
        stopped.resolve();
        await stop;
      });
      if (ordering === "after") {
        expect(result.current.isBusy).toBe(true);
        deliver("dictation");
      }
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith("Typed dictation");
      expect(result.current.isIdle()).toBe(true);
      deliver("duplicate");
      expect(onChange).toHaveBeenCalledOnce();
    },
  );

  it("blocks duplicate starts synchronously before React commits the starting phase", async () => {
    const started = deferred<boolean>();
    transport.startRecording.mockReturnValue(started.promise);
    const { result } = renderHook(() => useTextDictation({ value: "", onChange: vi.fn() }));
    let first!: Promise<void>;
    act(() => {
      first = result.current.start();
      expect(result.current.isIdle()).toBe(false);
      void result.current.start();
    });
    expect(transport.startRecording).toHaveBeenCalledOnce();
    await act(async () => {
      started.resolve(true);
      await first;
    });
    expect(result.current.isRecording).toBe(true);
  });

  it("cancels pending microphone setup without letting its late resolution revive recording", async () => {
    const started = deferred<boolean>();
    const cancelled = deferred<void>();
    transport.startRecording.mockReturnValue(started.promise);
    transport.cancelTranscription.mockReturnValue(cancelled.promise);
    const onChange = vi.fn();
    const { result } = renderHook(() => useTextDictation({ value: "Draft", onChange }));
    let startup!: Promise<void>;
    let cancellation!: Promise<void>;
    act(() => {
      startup = result.current.start();
    });
    act(() => {
      cancellation = result.current.cancel();
    });
    deliver(" discarded");
    await act(async () => {
      started.resolve(true);
      await startup;
    });
    expect(result.current.phase).toBe(DICTATION_PHASES.CANCELLING);
    await act(async () => {
      cancelled.resolve();
      await cancellation;
    });
    expect(result.current.isIdle()).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses the latest controlled value and serially appends synchronous transcript updates", async () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(({ value }) => useTextDictation({ value, onChange }), {
      initialProps: { value: "Old" },
    });
    await act(async () => result.current.start());
    rerender({ value: "New draft" });
    deliver(" one");
    deliver(" two");
    expect(onChange).toHaveBeenLastCalledWith("New draft one two");
  });

  it("times out missing final text and discards late delivery after a new edit", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useTextDictation({ value, onChange, timeoutMs: 25 }),
      { initialProps: { value: "Draft" } },
    );
    await act(async () => result.current.start());
    await act(async () => result.current.stop());
    await act(async () => vi.advanceTimersByTime(25));
    expect(result.current.error).toBe(true);
    expect(result.current.isIdle()).toBe(true);
    expect(transport.cancelTranscription).toHaveBeenCalledOnce();
    rerender({ value: "Newer edit" });
    deliver(" late");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the final-transcript timeout when its host unmounts", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useTextDictation({ value: "Draft", onChange: vi.fn() }),
    );
    await act(async () => result.current.start());
    await act(async () => result.current.stop());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels when the host becomes blocked and prevents subsequent recording", async () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ blocked }) => useTextDictation({ value: "Draft", onChange, blocked }),
      { initialProps: { blocked: false } },
    );
    await act(async () => result.current.start());
    await act(async () => rerender({ blocked: true }));
    deliver(" discarded");
    await act(async () => result.current.start());
    expect(transport.cancelTranscription).toHaveBeenCalledOnce();
    expect(transport.startRecording).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("works after StrictMode effect replay without accepting updates after disposal", async () => {
    const onChange = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result, unmount } = renderHook(() => useTextDictation({ value: "Draft", onChange }), {
      wrapper,
    });
    await act(async () => result.current.start());
    expect(result.current.isRecording).toBe(true);
    const oldDelivery = transport.setInput;
    unmount();
    act(() => oldDelivery?.((current) => current + " stale"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores old startup completion across an unmount and a newly mounted recording", async () => {
    const started = deferred<boolean>();
    transport.startRecording.mockReturnValueOnce(started.promise);
    const oldChange = vi.fn();
    const first = renderHook(() => useTextDictation({ value: "Old", onChange: oldChange }));
    let startup!: Promise<void>;
    act(() => {
      startup = first.result.current.start();
    });
    const oldDelivery = transport.setInput;
    first.unmount();
    const newChange = vi.fn();
    const second = renderHook(() => useTextDictation({ value: "New", onChange: newChange }));
    await act(async () => second.result.current.start());
    await act(async () => {
      started.resolve(true);
      await startup;
    });
    act(() => oldDelivery?.((current) => current + " stale"));
    deliver(" words");
    expect(oldChange).not.toHaveBeenCalled();
    expect(newChange).toHaveBeenCalledWith("New words");
    expect(second.result.current.isRecording).toBe(true);
  });
});
