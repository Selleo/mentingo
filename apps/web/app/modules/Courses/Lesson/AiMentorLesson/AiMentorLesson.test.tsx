import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { LEARNING_HANDLES } from "../../../../../e2e/data/learning/handles";

import AiMentorLesson from "./AiMentorLesson";

import type { GetLessonByIdResponse } from "~/api/generated-api";

const state = vi.hoisted(() => ({
  preview: true,
  messages: [] as { id: string; role: string; parts: { type: string; text: string }[] }[],
  setMessages: vi.fn(),
  sendMessage: vi.fn(),
  judge: vi.fn(),
  retake: vi.fn(),
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({ ...state, status: "ready" }),
}));
vi.mock("~/api/mutations/useJudgeLesson", () => ({
  useJudgeLesson: () => ({ mutateAsync: state.judge, isPending: false }),
}));
vi.mock("~/api/mutations/useRetakeLesson", () => ({
  useRetakeLesson: () => ({ mutateAsync: state.retake, isPending: false }),
}));
vi.mock("~/api/queries/useCurrentThreadMessages", () => ({
  useCurrentThreadMessages: () => ({ isLoading: false }),
}));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useOptionalCourseAccessProvider: () => ({ isPreviewMode: state.preview }),
}));
vi.mock("./aiMentorChatTransport", () => ({ createAiMentorChatTransport: vi.fn() }));
vi.mock("./components/ChatMessage", () => ({
  default: ({ parts }: { parts: { text: string }[] }) => <p>{parts[0]?.text}</p>,
}));
vi.mock("./components/LessonForm", () => ({
  LessonForm: ({
    handleSubmit,
    input,
    handleInputChange,
  }: {
    handleSubmit: () => void;
    input: string;
    handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  }) => (
    <div>
      <textarea aria-label="Message" value={input} onChange={handleInputChange} />
      <button onClick={handleSubmit}>Send</button>
      <button>Microphone</button>
    </div>
  ),
}));
vi.mock("~/components/RichText/Viever", () => ({
  default: ({ content }: { content: string }) => <p>{content}</p>,
}));

const renderLesson = (
  overrides: Partial<GetLessonByIdResponse["data"]> = {},
  hideControls = false,
) =>
  renderWith().render(
    <MemoryRouter>
      <AiMentorLesson
        lesson={
          {
            id: "lesson-1",
            type: "ai_mentor",
            description: "Task description",
            ...overrides,
          } as GetLessonByIdResponse["data"]
        }
        lessonLoading={false}
        hideControls={hideControls}
      />
    </MemoryRouter>,
  );

describe("AI Mentor preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollTo = vi.fn();
    state.preview = true;
    state.messages = [];
  });

  it("shows the full lesson with disabled interaction even without a thread", async () => {
    renderLesson();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Microphone" })).toBeDisabled();
    expect(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON)).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(state.sendMessage).not.toHaveBeenCalled();
    expect(state.judge).not.toHaveBeenCalled();
    expect(state.retake).not.toHaveBeenCalled();
  });

  it("allows typing and sending on an active preview thread while grading stays disabled", async () => {
    renderLesson({ status: "active", threadId: "thread-1" });
    const input = screen.getByRole("textbox", { name: "Message" });
    expect(input).toBeEnabled();
    await userEvent.type(input, "Explain opening tags");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(state.sendMessage).toHaveBeenCalledWith({ text: "Explain opening tags" });
    expect(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON)).toBeDisabled();
    expect(state.judge).not.toHaveBeenCalled();
  });

  it("opens the task dialog with an explanation when no description was saved", async () => {
    renderLesson({ description: null });
    await userEvent.click(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("No task description has been added to this lesson."),
    ).toBeInTheDocument();
  });

  it("offers a confirmed retake for a completed preview instead of a disabled composer", async () => {
    renderLesson({ status: "completed", threadId: "thread-1", lessonCompleted: true });
    expect(screen.queryByRole("textbox", { name: "Message" })).not.toBeInTheDocument();
    expect(screen.queryByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON)).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_BUTTON));
    expect(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_MODAL)).toBeInTheDocument();
    expect(state.retake).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_CANCEL_BUTTON));
    expect(state.retake).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_BUTTON));
    await userEvent.click(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_CONFIRM_BUTTON));
    expect(state.retake).toHaveBeenCalledWith({ lessonId: "lesson-1", learningStateId: undefined });
    expect(state.sendMessage).not.toHaveBeenCalled();
  });

  it("enables the composer for an active learning thread", () => {
    state.preview = false;
    renderLesson({ status: "active", threadId: "thread-1", description: "" });
    expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled();
    expect(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON)).toBeEnabled();
  });

  it("renders the recorded conversation without lesson controls or an automatic task dialog", () => {
    state.messages = [
      {
        id: "message-1",
        role: "assistant",
        parts: [{ type: "text", text: "Recorded mentor reply" }],
      },
    ];
    renderLesson({ threadId: "thread-1", status: "active" }, true);
    expect(screen.getByText("Recorded mentor reply")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByTestId(LEARNING_HANDLES.AI_MENTOR_RETAKE_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
