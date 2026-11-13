import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLumaConfigured } from "~/api/queries/useLumaConfigured";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useVoiceMentor } from "~/modules/Voice/hooks/useVoiceMentor";
import { renderWith } from "~/utils/testUtils";

import { LEARNING_HANDLES } from "../../../../../../e2e/data/learning/handles";

import { LessonForm } from "./LessonForm";

vi.mock("~/api/queries/useLumaConfigured", () => ({ useLumaConfigured: vi.fn() }));
vi.mock("~/api/queries", () => ({
  useCurrentUserSuspense: () => ({ data: { firstName: "Preview", lastName: "Author" } }),
}));
vi.mock("~/modules/Voice/hooks/useVoiceMentor", () => ({ useVoiceMentor: vi.fn() }));
vi.mock("~/modules/Voice/hooks/useTranscription", () => ({
  useTranscription: () => ({
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelTranscription: vi.fn(),
  }),
}));
vi.mock("./LessonEmojiPicker", () => ({ LessonEmojiPicker: () => null }));

const voice = {
  isRecording: false,
  isStarting: false,
  isMuted: false,
  connectionState: "connected" as const,
  recoveryErrorCode: null,
  startVoiceMentor: vi.fn().mockResolvedValue(true),
  stopVoiceMentor: vi.fn().mockResolvedValue(true),
  restartVoiceMentor: vi.fn().mockResolvedValue(true),
  cancelVoiceMentor: vi.fn().mockResolvedValue(true),
  triggerWelcomeMessage: vi.fn().mockResolvedValue(true),
  setVoiceMentorMuted: vi.fn(),
  mentorSpeechPresentation: null,
};
const props = {
  voiceTarget: { lessonId: "lesson-1", preview: true },
  mentorName: "Ada",
  handleSubmit: vi.fn(),
  input: "",
  handleInputChange: vi.fn(),
  setInput: vi.fn(),
  messages: [],
  hasTaskDescription: false,
  taskDescription: "",
  onJudge: vi.fn().mockResolvedValue(undefined),
  isJudgePending: false,
  allowVoiceMentor: true,
  allowJudge: false,
  textReadOnly: true,
};
const renderForm = () =>
  renderWith().render(
    <TooltipProvider>
      <LessonForm {...props} />
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

describe("preview voice composer", () => {
  it("starts voice with the preview target through the real action button", async () => {
    renderForm();
    const action = screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON);
    expect(action).toHaveAttribute("data-mode", "voice");
    expect(action).toBeEnabled();
    expect(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_INPUT)).toBeDisabled();
    expect(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_MIC_BUTTON)).toBeDisabled();
    fireEvent.click(action);
    await waitFor(() => expect(voice.startVoiceMentor).toHaveBeenCalledOnce());
    expect(vi.mocked(useVoiceMentor).mock.lastCall?.[0].voiceTarget).toEqual(props.voiceTarget);
    expect(props.onJudge).not.toHaveBeenCalled();
  });

  it("disables grading in the real voice overlay during preview", async () => {
    voice.isRecording = true;
    renderForm();
    const check = screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_CHECK_BUTTON);
    expect(check).toBeDisabled();
    expect(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MOBILE_CHECK_BUTTON),
    ).toBeDisabled();
    fireEvent.click(check);
    expect(props.onJudge).not.toHaveBeenCalled();
    expect(voice.cancelVoiceMentor).not.toHaveBeenCalled();
  });

  it("does not offer voice when the provider is unavailable", () => {
    vi.mocked(useLumaConfigured).mockReturnValue({
      data: { voiceMentorEnabled: false },
    } as ReturnType<typeof useLumaConfigured>);
    renderForm();
    expect(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON),
    ).not.toHaveAttribute("data-mode", "voice");
  });
});
