import { VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTranscription } from "./useTranscription";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
}));
vi.mock("~/api/socket", () => ({
  acquireSocket: () => ({ on: mocks.on, off: mocks.off, connect: mocks.connect }),
  releaseSocket: mocks.release,
}));
vi.mock("../audio-stream", () => ({
  RealtimePCMStreamerWorklet: class {
    start = mocks.start;
    stop = mocks.stop;
    cancel = mocks.cancel;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.start.mockResolvedValue(undefined);
  mocks.stop.mockResolvedValue(undefined);
  mocks.cancel.mockResolvedValue(undefined);
});

/** Delivers a transport response without invoking a microphone or external provider. */
const deliver = (text: string) => {
  const callback = mocks.on.mock.calls.find(
    ([event]) => event === VOICE_SOCKET_EVENT.STOP_AUDIO,
  )?.[1];
  act(() => callback({ voiceAction: VOICE_ACTION.TRANSCRIPT, payload: text }));
};

describe("useTranscription ownership", () => {
  it("ignores unsolicited and canceled transcripts while preserving existing text", async () => {
    let input = "Typed draft ";
    const setInput = vi.fn((value) => {
      input = typeof value === "function" ? value(input) : value;
    });
    const { result } = renderHook(() => useTranscription({ setInput, onLevelChange: vi.fn() }));
    deliver("unrelated");
    expect(setInput).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.cancelTranscription();
    });
    deliver("discarded");
    expect(input).toBe("Typed draft ");
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });

  it("appends the final stopped transcript without starting another recording", async () => {
    let input = "Typed draft ";
    const setInput = vi.fn((value) => {
      input = typeof value === "function" ? value(input) : value;
    });
    const { result, unmount } = renderHook(() =>
      useTranscription({ setInput, onLevelChange: vi.fn() }),
    );
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.stopRecording();
    });
    deliver("dictated text");
    deliver("unrelated later text");
    expect(input).toBe("Typed draft dictated text");
    unmount();
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it("cancels microphone setup that completes after unmount and rejects duplicate starts", async () => {
    let resolveStart!: () => void;
    mocks.start.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve;
        }),
    );
    const { result, unmount } = renderHook(() =>
      useTranscription({ setInput: vi.fn(), onLevelChange: vi.fn() }),
    );
    let start!: Promise<boolean>;
    act(() => {
      start = result.current.startRecording();
    });
    expect(await result.current.startRecording()).toBe(false);
    unmount();
    await act(async () => {
      resolveStart();
      expect(await start).toBe(false);
    });
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });

  it("does not tear down recording when the host replaces its callback", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ setInput }) => useTranscription({ setInput, onLevelChange: vi.fn() }),
      { initialProps: { setInput: first } },
    );
    await act(async () => {
      await result.current.startRecording();
    });
    rerender({ setInput: second });
    deliver("words");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(mocks.cancel).not.toHaveBeenCalled();
    unmount();
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });

  it("releases failed startup resources and reports microphone denial without accepting text", async () => {
    mocks.start.mockRejectedValue(new Error("permission denied"));
    const setInput = vi.fn();
    const { result, unmount } = renderHook(() =>
      useTranscription({ setInput, onLevelChange: vi.fn() }),
    );
    await act(async () => {
      expect(await result.current.startRecording()).toBe(false);
    });
    deliver("unexpected");
    expect(setInput).not.toHaveBeenCalled();
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    unmount();
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });
});
