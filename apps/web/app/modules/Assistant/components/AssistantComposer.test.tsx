import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { ASSISTANT_HANDLES } from "../../../../e2e/data/assistant/handles";

import { AssistantComposer } from "./AssistantComposer";

type InputSetter = (next: string | ((current: string) => string)) => void;
const voice = vi.hoisted(() => ({
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  cancelTranscription: vi.fn(),
  setInput: null as InputSetter | null,
}));
vi.mock("~/modules/Voice/hooks/useTranscription", () => ({
  useTranscription: ({ setInput }: { setInput: InputSetter }) => {
    voice.setInput = setInput;
    return voice;
  },
}));
vi.mock("@mentingo/voice", () => ({
  VoiceLevelBars: () => <span data-testid="voice-levels" />,
}));

const props = () => ({
  value: "Find onboarding courses",
  onChange: vi.fn(),
  onSend: vi.fn(),
  onCancel: vi.fn(),
  running: false,
  submitting: false,
  cancelling: false,
});
const mic = () => screen.getByRole("button", { name: "Toggle voice input" });
const stop = () => screen.getByRole("button", { name: "Stop voice recording" });
const close = () => screen.getByRole("button", { name: "Close voice mode" });
const textarea = () => screen.getByTestId(ASSISTANT_HANDLES.COMPOSER);
function Harness({
  initialValue = "Typed draft",
  onSend = vi.fn(),
}: {
  initialValue?: string;
  onSend?: () => void;
}) {
  const [value, onChange] = useState(initialValue);
  return <AssistantComposer {...props()} value={value} onChange={onChange} onSend={onSend} />;
}
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  voice.startRecording.mockReset().mockResolvedValue(true);
  voice.stopRecording.mockReset().mockResolvedValue(undefined);
  voice.cancelTranscription.mockReset().mockResolvedValue(undefined);
  voice.setInput = null;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AssistantComposer", () => {
  it("sends on Enter, retains Shift+Enter and composition for multilingual input", () => {
    const input = props();
    renderWith().render(<AssistantComposer {...input} />);
    fireEvent.keyDown(textarea(), { key: "Enter", shiftKey: true });
    fireEvent.compositionStart(textarea());
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(input.onSend).not.toHaveBeenCalled();
    fireEvent.compositionEnd(textarea());
    fireEvent.keyDown(textarea(), { key: "Enter", isComposing: true });
    expect(input.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(input.onSend).toHaveBeenCalledTimes(1);
  });

  it("allows drafting during a run, prevents recording or another send, and exposes run stop", () => {
    const input = props();
    renderWith().render(<AssistantComposer {...input} running />);
    expect(textarea()).not.toBeDisabled();
    expect(mic()).toBeDisabled();
    fireEvent.keyDown(textarea(), { key: "Enter" });
    fireEvent.click(mic());
    expect(input.onSend).not.toHaveBeenCalled();
    expect(voice.startRecording).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.CANCEL));
    expect(input.onCancel).toHaveBeenCalledTimes(1);
    expect(voice.cancelTranscription).not.toHaveBeenCalled();
  });

  it("does not submit whitespace or duplicate a pending submission", () => {
    const input = props();
    const { rerender } = renderWith().render(<AssistantComposer {...input} value="  " />);
    expect(screen.getByTestId(ASSISTANT_HANDLES.SEND)).toBeDisabled();
    rerender(<AssistantComposer {...input} submitting />);
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(input.onSend).not.toHaveBeenCalled();
    expect(mic()).toBeDisabled();
  });

  it("appends dictated text to the latest typed draft without sending, including during Stop", async () => {
    const onSend = vi.fn();
    voice.stopRecording.mockImplementation(async () => {
      voice.setInput?.((current) => `${current} dictated text`);
    });
    renderWith().render(<Harness onSend={onSend} />);
    fireEvent.change(textarea(), { target: { value: "Updated typed draft" } });
    fireEvent.click(mic());
    await screen.findByRole("button", { name: "Stop voice recording" });
    expect(screen.getByTestId("voice-levels")).toBeVisible();
    expect(stop()).toHaveAttribute("type", "button");
    fireEvent.click(stop());
    await waitFor(() => expect(textarea()).not.toBeDisabled());
    expect(textarea()).toHaveValue("Updated typed draft dictated text");
    expect(onSend).not.toHaveBeenCalled();
    expect(voice.stopRecording).toHaveBeenCalledOnce();
    expect(voice.cancelTranscription).not.toHaveBeenCalled();
  });

  it("cancels dictation separately from response cancellation and ignores discarded transcripts", async () => {
    const input = props();
    renderWith().render(<AssistantComposer {...input} />);
    fireEvent.click(mic());
    await screen.findByRole("button", { name: "Stop voice recording" });
    fireEvent.click(close());
    await waitFor(() => expect(mic()).not.toBeDisabled());
    act(() => voice.setInput?.((current) => `${current} discarded`));
    expect(input.onChange).not.toHaveBeenCalled();
    expect(input.onSend).not.toHaveBeenCalled();
    expect(input.onCancel).not.toHaveBeenCalled();
    expect(voice.cancelTranscription).toHaveBeenCalledOnce();
    expect(voice.stopRecording).not.toHaveBeenCalled();
    expect(textarea()).toHaveValue(input.value);
  });

  it.each([false, "reject"])(
    "recovers from microphone start failure (%s) without changing the draft",
    async (result) => {
      if (result === "reject") voice.startRecording.mockRejectedValue(new Error("denied"));
      else voice.startRecording.mockResolvedValue(false);
      const input = props();
      renderWith().render(<AssistantComposer {...input} />);
      fireEvent.click(mic());
      expect(await screen.findByRole("alert")).toHaveTextContent("Voice input is unavailable");
      expect(mic()).not.toBeDisabled();
      expect(input.onChange).not.toHaveBeenCalled();
      expect(input.onSend).not.toHaveBeenCalled();
    },
  );

  it("blocks Enter, form submission and recording restart during startup and final transcription", async () => {
    const starting = deferred<boolean>();
    const stopping = deferred<void>();
    voice.startRecording.mockReturnValue(starting.promise);
    voice.stopRecording.mockReturnValue(stopping.promise);
    const onSend = vi.fn();
    renderWith().render(<Harness onSend={onSend} />);
    fireEvent.click(mic());
    expect(mic()).toBeDisabled();
    fireEvent.keyDown(textarea(), { key: "Enter" });
    fireEvent.submit(textarea().closest("form")!);
    await act(async () => starting.resolve(true));
    fireEvent.keyDown(textarea(), { key: "Enter" });
    fireEvent.click(stop());
    expect(screen.getByRole("status")).toHaveTextContent("Transcribing…");
    fireEvent.keyDown(textarea(), { key: "Enter" });
    fireEvent.submit(textarea().closest("form")!);
    expect(screen.getByTestId(ASSISTANT_HANDLES.SEND)).toBeDisabled();
    await act(async () => stopping.resolve());
    // Stop acknowledgement can precede the socket's final transcript.
    expect(screen.getByTestId(ASSISTANT_HANDLES.SEND)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Toggle voice input" })).not.toBeInTheDocument();
    act(() => voice.setInput?.((current) => `${current} final words`));
    expect(textarea()).toHaveValue("Typed draft final words");
    expect(screen.getByTestId(ASSISTANT_HANDLES.SEND)).not.toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
    expect(voice.startRecording).toHaveBeenCalledOnce();
  });

  it("retains an oversized dictated draft, blocks sending and permits shortening it", async () => {
    voice.stopRecording.mockImplementation(async () =>
      voice.setInput?.((current) => `${current} ${"x".repeat(8000)}`),
    );
    const onSend = vi.fn();
    renderWith().render(<Harness onSend={onSend} />);
    fireEvent.click(mic());
    await screen.findByRole("button", { name: "Stop voice recording" });
    fireEvent.click(stop());
    await waitFor(() => expect(textarea()).not.toBeDisabled());
    expect(textarea()).toHaveValue(`Typed draft ${"x".repeat(8000)}`);
    expect(textarea()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByTestId(ASSISTANT_HANDLES.SEND)).toBeDisabled();
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.change(textarea(), { target: { value: "Shortened draft" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId(ASSISTANT_HANDLES.SEND)).not.toBeDisabled();
  });

  it("times out a missing final transcript and rejects late delivery after a newer typed edit", async () => {
    vi.useFakeTimers();
    renderWith().render(<Harness />);
    await act(async () => fireEvent.click(mic()));
    await act(async () => fireEvent.click(stop()));
    await act(async () => vi.advanceTimersByTime(15_000));
    expect(screen.getByRole("alert")).toHaveTextContent("Voice input is unavailable");
    expect(mic()).not.toBeDisabled();
    fireEvent.change(textarea(), { target: { value: "A newer typed draft" } });
    act(() => voice.setInput?.((current) => `${current} stale transcript`));
    expect(textarea()).toHaveValue("A newer typed draft");
    expect(voice.cancelTranscription).toHaveBeenCalledOnce();
  });

  it("discards dictation if permissions or run state disable input during recording", async () => {
    const input = props();
    const { rerender } = renderWith().render(<AssistantComposer {...input} />);
    fireEvent.click(mic());
    await screen.findByRole("button", { name: "Stop voice recording" });
    rerender(<AssistantComposer {...input} disabled />);
    await waitFor(() => expect(voice.cancelTranscription).toHaveBeenCalledOnce());
    act(() => voice.setInput?.((current) => `${current} late`));
    expect(input.onChange).not.toHaveBeenCalled();
  });

  it.each(["stop", "cancel"])(
    "recovers from a failed voice %s without losing the typed draft",
    async (action) => {
      const input = props();
      if (action === "stop") voice.stopRecording.mockRejectedValue(new Error("failed"));
      else voice.cancelTranscription.mockRejectedValue(new Error("failed"));
      renderWith().render(<AssistantComposer {...input} />);
      fireEvent.click(mic());
      await screen.findByRole("button", { name: "Stop voice recording" });
      fireEvent.click(action === "stop" ? stop() : close());
      expect(await screen.findByRole("alert")).toHaveTextContent("Voice input is unavailable");
      expect(mic()).not.toBeDisabled();
      expect(textarea()).toHaveValue(input.value);
      expect(input.onSend).not.toHaveBeenCalled();
      expect(input.onChange).not.toHaveBeenCalled();
    },
  );

  it("remeasures wrapped input when its available width changes and disconnects on unmount", () => {
    let observeResize: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observeResize = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const { unmount } = renderWith().render(<Harness />);
    const input = textarea() as HTMLTextAreaElement;
    let height = 72;
    Object.defineProperty(input, "scrollHeight", { get: () => height });
    act(() =>
      observeResize?.(
        [{ contentRect: { width: 240 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    );
    expect(input.style.height).toBe("72px");
    height = 300;
    act(() =>
      observeResize?.(
        [{ contentRect: { width: 180 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    );
    expect(input.style.overflowY).toBe("auto");
    expect(Number.parseFloat(input.style.height)).toBeLessThan(height);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("ignores pending startup and transcript delivery after a thread switch unmounts the composer", async () => {
    const starting = deferred<boolean>();
    voice.startRecording.mockReturnValue(starting.promise);
    const input = props();
    const { unmount } = renderWith().render(<AssistantComposer {...input} />);
    fireEvent.click(mic());
    unmount();
    await act(async () => starting.resolve(true));
    act(() => voice.setInput?.((current) => `${current} late`));
    expect(input.onChange).not.toHaveBeenCalled();
    expect(input.onSend).not.toHaveBeenCalled();
  });
});
