import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringComposer } from "./AuthoringComposer";

type InputSetter = (value: string | ((current: string) => string)) => void;

const transcriptionMock = vi.hoisted(() => ({
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  cancelTranscription: vi.fn(),
  inputSetter: null as InputSetter | null,
}));

vi.mock("~/modules/Voice/hooks/useTranscription", () => ({
  useTranscription: (props: { setInput: InputSetter }) => {
    transcriptionMock.inputSetter = props.setInput;
    return transcriptionMock;
  },
}));

const ComposerHarness = ({
  onSubmit = vi.fn(),
  reasoningControl,
}: {
  onSubmit?: () => void;
  reasoningControl?: ReactNode;
}) => {
  const [instruction, setInstruction] = useState("Typed draft");
  return (
    <AuthoringComposer
      instruction={instruction}
      onInstructionChange={setInstruction}
      onSubmit={onSubmit}
      reasoningControl={reasoningControl}
    />
  );
};

beforeEach(() => {
  transcriptionMock.startRecording.mockReset().mockResolvedValue(true);
  transcriptionMock.stopRecording.mockReset().mockResolvedValue(undefined);
  transcriptionMock.cancelTranscription.mockReset().mockResolvedValue(undefined);
  transcriptionMock.inputSetter = null;
});

describe("AuthoringComposer", () => {
  it("keeps the default interaction text first and removes example chips", () => {
    const onInstructionChange = vi.fn();
    const onSubmit = vi.fn();

    renderWith().render(
      <AuthoringComposer
        instruction=""
        onInstructionChange={onInstructionChange}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("Describe your request")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(
      screen.queryByRole("button", {
        name: "Create a practical onboarding course for new managers",
      }),
    ).not.toBeInTheDocument();
    expect(onInstructionChange).not.toHaveBeenCalled();
  });

  it("submits only non-empty instructions", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWith().render(
      <AuthoringComposer
        instruction="Build a course"
        onInstructionChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("replaces Send with the same sized stop action while generation is active", async () => {
    const user = userEvent.setup();
    const onStopGeneration = vi.fn();
    const onSubmit = vi.fn();
    renderWith().render(
      <AuthoringComposer
        instruction="Build a course"
        hasActiveGeneration
        onStopGeneration={onStopGeneration}
        onInstructionChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const action = screen.getByTestId("course-authoring-brief-submit-button");
    expect(action).toHaveAccessibleName("Stop");
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId("course-authoring-brief-input"), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(action);
    expect(onStopGeneration).toHaveBeenCalledOnce();
  });

  it("submits on Enter while preserving Shift+Enter and IME composition", () => {
    const onSubmit = vi.fn();
    renderWith().render(
      <AuthoringComposer
        instruction="Build a course"
        onInstructionChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByTestId("course-authoring-brief-input");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("keeps the legacy showExamples prop compatible without rendering chips", () => {
    renderWith().render(
      <AuthoringComposer
        instruction=""
        showExamples={false}
        onInstructionChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Create a practical onboarding course for new managers",
      }),
    ).not.toBeInTheDocument();
  });

  it("inserts completed transcription into the draft without submitting it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWith().render(<ComposerHarness onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Toggle voice input" }));
    expect(screen.getByRole("button", { name: "Stop voice recording" })).toBeInTheDocument();
    act(() => {
      transcriptionMock.inputSetter?.((current) => `${current} dictated text`);
    });
    await user.click(screen.getByRole("button", { name: "Stop voice recording" }));

    expect(await screen.findByTestId("course-authoring-brief-input")).toHaveValue(
      "Typed draft dictated text",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("never submits when a transcript resolves during the stop click", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    transcriptionMock.stopRecording.mockImplementation(async () => {
      transcriptionMock.inputSetter?.("Dictated request");
    });
    renderWith().render(<ComposerHarness onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Toggle voice input" }));
    const stop = screen.getByRole("button", { name: "Stop voice recording" });
    expect(stop).toHaveAttribute("type", "button");
    await user.click(stop);

    expect(await screen.findByTestId("course-authoring-brief-input")).toHaveValue(
      "Dictated request",
    );
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "button");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides the reasoning control while recording", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <ComposerHarness reasoningControl={<button type="button">Effort</button>} />,
    );

    await user.click(screen.getByRole("button", { name: "Toggle voice input" }));

    expect(await screen.findByTestId("course-authoring-voice-panel")).toHaveAttribute(
      "data-state",
      "listening",
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Effort" })).not.toBeInTheDocument(),
    );
  });

  it("shows a transcribing state and blocks sending until the transcript arrives", async () => {
    let finish: () => void = () => undefined;
    transcriptionMock.stopRecording.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    renderWith().render(<ComposerHarness />);

    await user.click(screen.getByRole("button", { name: "Toggle voice input" }));
    await screen.findByTestId("course-authoring-voice-panel");
    await user.click(screen.getByRole("button", { name: "Stop voice recording" }));

    const panel = await screen.findByTestId("course-authoring-voice-panel");
    await waitFor(() => expect(panel).toHaveAttribute("data-state", "transcribing"));
    expect(panel).toHaveTextContent("Transcribing…");
    expect(screen.getByRole("button", { name: "Stop voice recording" })).toBeDisabled();

    await act(async () => finish());
    expect(await screen.findByTestId("course-authoring-brief-input")).toHaveValue("Typed draft");
  });

  it("shows a localized error when the microphone cannot start", async () => {
    transcriptionMock.startRecording.mockResolvedValue(false);
    const user = userEvent.setup();
    renderWith().render(<ComposerHarness />);

    await user.click(screen.getByRole("button", { name: "Toggle voice input" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop voice recording" })).not.toBeInTheDocument();
  });

  it("cancels voice mode without submitting or changing the typed draft", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWith().render(<ComposerHarness onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Toggle voice input" }));
    await user.click(screen.getByRole("button", { name: "Close voice mode" }));

    expect(transcriptionMock.cancelTranscription).toHaveBeenCalledOnce();
    expect(await screen.findByTestId("course-authoring-brief-input")).toHaveValue("Typed draft");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("forwards a pasted file to onPasteFile instead of inserting it as text", () => {
    const onInstructionChange = vi.fn();
    const onPasteFile = vi.fn();
    renderWith().render(
      <AuthoringComposer
        instruction=""
        onInstructionChange={onInstructionChange}
        onSubmit={vi.fn()}
        onPasteFile={onPasteFile}
      />,
    );
    const file = new File(["guide"], "guide.pdf", { type: "application/pdf" });

    fireEvent.paste(screen.getByTestId("course-authoring-brief-input"), {
      clipboardData: { files: [file] },
    });

    expect(onPasteFile).toHaveBeenCalledOnce();
    expect(onPasteFile).toHaveBeenCalledWith(file);
    expect(onInstructionChange).not.toHaveBeenCalled();
  });

  it("does not intercept a paste with no file in the clipboard", () => {
    const onPasteFile = vi.fn();
    renderWith().render(
      <AuthoringComposer
        instruction=""
        onInstructionChange={vi.fn()}
        onSubmit={vi.fn()}
        onPasteFile={onPasteFile}
      />,
    );

    fireEvent.paste(screen.getByTestId("course-authoring-brief-input"), {
      clipboardData: { files: [] },
    });

    expect(onPasteFile).not.toHaveBeenCalled();
  });
});
