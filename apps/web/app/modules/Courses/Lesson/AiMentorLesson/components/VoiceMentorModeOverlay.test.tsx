import { VOICE_MODE_STATE } from "@repo/shared";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VOICE_CONNECTION_STATE } from "~/modules/Voice/audio-stream.types";

import { LEARNING_HANDLES } from "../../../../../../e2e/data/learning/handles";
import { renderWith } from "../../../../../utils/testUtils";

import { VoiceMentorModeOverlay } from "./VoiceMentorModeOverlay";

vi.mock("~/components/agents-ui/agent-audio-visualizer-aura", () => ({
  AgentAudioVisualizerAura: () => <div data-testid="mentor-aura" />,
}));

vi.mock("~/components/agents-ui/agent-audio-visualizer-wave", () => ({
  AgentAudioVisualizerWave: () => <div data-testid="mentor-wave" />,
}));

vi.mock("~/components/RichText/Viever", () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

const renderOverlay = ({
  onJudge = vi.fn(async () => undefined),
  onMicMutedChange = vi.fn(),
  onRestart = vi.fn(),
  onExit = vi.fn(),
  connectionState = VOICE_CONNECTION_STATE.CONNECTED,
}: {
  onJudge?: () => Promise<void>;
  onMicMutedChange?: (muted: boolean) => void;
  onRestart?: () => void;
  onExit?: () => void;
  connectionState?: (typeof VOICE_CONNECTION_STATE)[keyof typeof VOICE_CONNECTION_STATE];
} = {}) => {
  renderWith().render(
    <VoiceMentorModeOverlay
      open
      state={VOICE_MODE_STATE.IDLE}
      voiceLevel={0}
      mentorVoiceLevel={0}
      learnerTranscript={null}
      response=""
      mentorSpeech={null}
      mentorName="Mentor"
      hasTaskDescription
      taskDescription="Practice the customer conversation."
      onJudge={onJudge}
      isJudgePending={false}
      isMicMuted={false}
      connectionState={connectionState}
      isRestarting={false}
      onMicMutedChange={onMicMutedChange}
      onRestart={onRestart}
      onExit={onExit}
    />,
  );

  return { onExit, onJudge, onMicMutedChange, onRestart };
};

describe("VoiceMentorModeOverlay", () => {
  it("keeps the voice overlay mounted while showing the task panel", () => {
    renderOverlay();

    fireEvent.click(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_TASK_BUTTON));

    expect(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY)).toBeInTheDocument();
    expect(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_TASK_PANEL),
    ).toBeInTheDocument();
  });

  it("offers an in-overlay action to request AI Judge feedback", () => {
    const { onJudge } = renderOverlay();

    fireEvent.click(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_CHECK_BUTTON));

    expect(onJudge).toHaveBeenCalledOnce();
  });

  it("keeps the mobile voice controls available while the task is open", () => {
    const { onExit, onJudge, onMicMutedChange } = renderOverlay();

    fireEvent.click(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MOBILE_TASK_BUTTON),
    );

    expect(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_TASK_PANEL),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MUTE_BUTTON),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MOBILE_CHECK_BUTTON),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MOBILE_EXIT_BUTTON),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MUTE_BUTTON));
    fireEvent.click(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MOBILE_CHECK_BUTTON),
    );
    fireEvent.click(
      screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MOBILE_EXIT_BUTTON),
    );

    expect(onMicMutedChange).toHaveBeenCalledWith(true);
    expect(onJudge).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("offers a restart action when voice recovery fails", () => {
    const { onRestart } = renderOverlay({
      connectionState: VOICE_CONNECTION_STATE.FAILED,
    });

    fireEvent.click(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_RESTART_BUTTON));

    expect(onRestart).toHaveBeenCalledOnce();
  });

  it("keeps automatic voice recovery under the hood", () => {
    renderOverlay({
      connectionState: VOICE_CONNECTION_STATE.RECOVERING,
    });

    expect(
      screen.queryByTestId(LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_RECOVERY_STATUS),
    ).not.toBeInTheDocument();
  });
});
