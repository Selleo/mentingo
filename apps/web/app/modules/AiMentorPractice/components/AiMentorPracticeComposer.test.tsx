import { createTextUiMessage, LEARNER_TRANSCRIPT_STATUSES } from "@repo/shared";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLumaConfigured } from "~/api/queries/useLumaConfigured";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useVoiceMentor } from "~/modules/Voice/hooks/useVoiceMentor";
import { renderWith } from "~/utils/testUtils";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../../e2e/data/ai-mentor-practice/handles";
import { LEARNING_HANDLES } from "../../../../e2e/data/learning/handles";

import { AiMentorPracticeComposer } from "./AiMentorPracticeComposer";

import type { UIMessage } from "@ai-sdk/react";
import type { ComponentProps } from "react";
import type { VoiceMentorModeOverlay } from "~/modules/Courses/Lesson/AiMentorLesson/components/VoiceMentorModeOverlay";

vi.mock("~/api/queries/useLumaConfigured", () => ({ useLumaConfigured: vi.fn() }));
vi.mock("~/modules/Voice/hooks/useVoiceMentor", () => ({ useVoiceMentor: vi.fn() }));
vi.mock("~/modules/Voice/hooks/useTranscription", () => ({
  useTranscription: () => ({
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelTranscription: vi.fn(),
  }),
}));
vi.mock("~/modules/Courses/Lesson/AiMentorLesson/components/LessonEmojiPicker", () => ({
  LessonEmojiPicker: () => null,
}));
vi.mock("~/modules/Courses/Lesson/AiMentorLesson/components/VoiceMentorModeOverlay", () => ({
  VoiceMentorModeOverlay: ({
    open,
    onJudge,
    canJudge,
    isJudgePending,
    onExit,
  }: ComponentProps<typeof VoiceMentorModeOverlay>) =>
    open && (
      <>
        <button data-testid="voice-check" disabled={!canJudge || isJudgePending} onClick={onJudge}>
          Check voice
        </button>
        <button data-testid="voice-exit" onClick={onExit}>
          Exit voice
        </button>
      </>
    ),
}));

const voice = {
  isRecording: false,
  isStarting: false,
  isMuted: false,
  connectionState: "connected" as const,
  recoveryErrorCode: null,
  stopVoiceMentor: vi.fn().mockResolvedValue(true),
  startVoiceMentor: vi.fn().mockResolvedValue(true),
  restartVoiceMentor: vi.fn().mockResolvedValue(true),
  cancelVoiceMentor: vi.fn().mockResolvedValue(true),
  triggerWelcomeMessage: vi.fn().mockResolvedValue(true),
  setVoiceMentorMuted: vi.fn(),
  mentorSpeechPresentation: null,
};
const props = {
  practiceSessionId: "practice-1",
  threadId: "attempt-1",
  mentorName: "Maya",
  handleSubmit: vi.fn(),
  onLearnerTranscription: vi.fn(),
  onMentorResponseCompleted: vi.fn(),
  onAudioInterrupted: vi.fn(),
  onAudioOutputCompleted: vi.fn(),
  onJudge: vi.fn().mockResolvedValue(undefined),
  isJudgePending: false,
  handleInputChange: vi.fn(),
  input: "",
  setInput: vi.fn(),
  messages: [createTextUiMessage<UIMessage>({ id: "user-1", role: "user", content: "My answer" })],
  hasTaskDescription: false,
  taskDescription: "",
  hasLearnerMessage: true,
  isProcessing: false,
};
const renderComposer = (overrides: Partial<typeof props> = {}) =>
  renderWith().render(
    <TooltipProvider>
      <AiMentorPracticeComposer {...props} {...overrides} />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  voice.isRecording = false;
  vi.mocked(useVoiceMentor).mockReturnValue(voice);
  vi.mocked(useLumaConfigured).mockReturnValue({ data: { voiceMentorEnabled: true } } as ReturnType<
    typeof useLumaConfigured
  >);
});

describe("Practice voice composer", () => {
  it("enables the existing voice action with the Practice attempt target", async () => {
    renderComposer();
    expect(vi.mocked(useVoiceMentor).mock.lastCall?.[0].voiceTarget).toEqual({
      practiceSessionId: "practice-1",
      threadId: "attempt-1",
    });
    const button = screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON);
    expect(button).toHaveAttribute("data-mode", "voice");
    fireEvent.click(button);
    await waitFor(() => expect(voice.startVoiceMentor).toHaveBeenCalledOnce());
  });

  it.each(["unavailable", "text-processing"])("does not offer voice when %s", (reason) => {
    vi.mocked(useLumaConfigured).mockReturnValue({
      data: { voiceMentorEnabled: reason !== "unavailable" },
    } as ReturnType<typeof useLumaConfigured>);
    renderComposer({ isProcessing: reason === "text-processing" });
    expect(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON),
    ).not.toHaveAttribute("data-mode", "voice");
  });

  it("waits for the turn, then stops voice before judging the Practice", async () => {
    voice.isRecording = true;
    renderComposer();
    expect(screen.getByTestId(AI_MENTOR_PRACTICE_HANDLES.CHECK_BUTTON)).toBeDisabled();
    act(() =>
      vi.mocked(useVoiceMentor).mock.lastCall?.[0].onLearnerTranscription?.({
        text: "My spoken answer",
        turnId: "turn-1",
        segmentId: "segment-1",
        revision: 1,
        status: LEARNER_TRANSCRIPT_STATUSES.FINAL,
      }),
    );
    expect(props.onLearnerTranscription).toHaveBeenCalledWith("My spoken answer", "turn-1");
    expect(screen.getByTestId("voice-check")).toBeDisabled();
    act(() =>
      vi.mocked(useVoiceMentor).mock.lastCall?.[0].onMentorResponseCompleted?.("Mentor reply"),
    );
    fireEvent.click(screen.getByTestId("voice-check"));
    await waitFor(() => expect(props.onJudge).toHaveBeenCalledOnce());
    expect(voice.cancelVoiceMentor.mock.invocationCallOrder[0]).toBeLessThan(
      props.onJudge.mock.invocationCallOrder[0],
    );
  });

  it("refreshes persisted messages when leaving voice", async () => {
    voice.isRecording = true;
    renderComposer();
    fireEvent.click(screen.getByTestId("voice-exit"));
    await waitFor(() => expect(props.onAudioOutputCompleted).toHaveBeenCalledOnce());
    expect(voice.cancelVoiceMentor).toHaveBeenCalledOnce();
  });
});
