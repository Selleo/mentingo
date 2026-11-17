import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { LEARNING_HANDLES } from "../../../../../e2e/data/learning/handles";

import AiMentorLesson from "./AiMentorLesson";

import type { GetLessonByIdResponse } from "~/api/generated-api";

const state = vi.hoisted(() => ({
  preview: true,
  canEditCourse: false,
  messages: [] as { id: string; role: string; parts: { type: string; text: string }[] }[],
  status: "ready",
  setMessages: vi.fn(),
  sendMessage: vi.fn(),
  judge: vi.fn(),
  retake: vi.fn(),
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({ ...state }),
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
  useOptionalCourseAccessProvider: () => ({
    isPreviewMode: state.preview,
    canEditCourse: state.canEditCourse,
  }),
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
    allowVoiceMentor,
    allowJudge,
    voiceTarget,
  }: {
    allowVoiceMentor: boolean;
    allowJudge: boolean;
    voiceTarget: { lessonId: string; preview?: boolean };
    handleSubmit: () => void;
    input: string;
    handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  }) => (
    <div>
      <textarea aria-label="Message" value={input} onChange={handleInputChange} />
      <button onClick={handleSubmit}>Send</button>
      <button>Microphone</button>
      {allowVoiceMentor && <button data-preview={String(voiceTarget.preview)}>Voice Mentor</button>}
      {allowJudge && <button>Voice grade</button>}
    </div>
  ),
}));
vi.mock("~/components/RichText/Viever", () => ({
  default: ({ content }: { content: string }) => <p>{content}</p>,
}));

type Lesson = GetLessonByIdResponse["data"];

const makeLesson = (overrides: Partial<Lesson> = {}): Lesson => ({
  id: "lesson-1",
  title: "Simulation",
  type: "ai_mentor",
  description: "Task description",
  fileType: null,
  fileUrl: null,
  thresholdScore: null,
  attemptsLimit: null,
  quizCooldownInHours: null,
  isQuizPassed: null,
  attempts: null,
  updatedAt: null,
  displayOrder: 1,
  nextLessonId: null,
  ...overrides,
});

const renderLessonElement = (overrides: Partial<Lesson> = {}, hideControls = false) => (
  <MemoryRouter>
    <AiMentorLesson
      lesson={makeLesson(overrides)}
      lessonLoading={false}
      hideControls={hideControls}
    />
  </MemoryRouter>
);

const renderLesson = (overrides: Partial<Lesson> = {}, hideControls = false) =>
  renderWith().render(renderLessonElement(overrides, hideControls));

const mentorReply = (text: string) => ({
  id: "reply-1",
  role: "assistant",
  parts: [{ type: "text", text }],
});

describe("AI Mentor preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollTo = vi.fn();
    state.preview = true;
    state.canEditCourse = false;
    state.messages = [];
    state.status = "ready";
  });

  it("enables voice for an authorized author preview without a thread but never grading", () => {
    state.canEditCourse = true;
    renderLesson();
    expect(screen.getByRole("button", { name: "Voice Mentor" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Voice Mentor" })).toHaveAttribute(
      "data-preview",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Voice grade" })).not.toBeInTheDocument();
    expect(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON)).toBeDisabled();
  });

  it("does not offer Voice Mentor to a public course preview", () => {
    renderLesson({ status: "active", threadId: "thread-1" });
    expect(screen.queryByRole("button", { name: "Voice Mentor" })).not.toBeInTheDocument();
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

describe("AI Mentor accessibility", () => {
  const activeLesson = { status: "active", threadId: "thread-1" } satisfies Partial<Lesson>;

  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollTo = vi.fn();
    state.preview = false;
    state.canEditCourse = false;
    state.messages = [];
    state.status = "ready";
  });

  it("announces a mentor reply once, only after it has finished streaming", () => {
    state.preview = true;
    const { rerender } = renderLesson(activeLesson);
    const conversation = screen.getByRole("log", { name: "Conversation" });

    expect(conversation).toHaveAttribute("aria-live", "off");
    const announcer = screen.getByRole("status");

    expect(announcer).toBeEmptyDOMElement();

    state.status = "streaming";
    state.messages = [mentorReply("Hello, I am")];
    rerender(renderLessonElement(activeLesson));
    expect(conversation).toHaveTextContent("Hello, I am");
    expect(announcer).toBeEmptyDOMElement();

    state.status = "ready";
    state.messages = [mentorReply("Hello, I am your client today.")];
    rerender(renderLessonElement(activeLesson));
    expect(announcer).toHaveTextContent("Hello, I am your client today.");
  });

  it("does not announce the history loaded when the lesson opens", () => {
    state.preview = true;
    state.messages = [mentorReply("Earlier reply")];
    renderLesson(activeLesson);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("moves focus into the auto-opened task dialog and back to the task button on close", async () => {
    renderLesson(activeLesson);
    const dialog = await screen.findByRole("dialog");

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION)).toHaveFocus();
  });

  it("returns focus to the task button after opening the dialog from it", async () => {
    renderLesson({ ...activeLesson, lessonCompleted: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const taskButton = screen.getByTestId(LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION);

    await userEvent.click(taskButton);
    const dialog = screen.getByRole("dialog");

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(taskButton).toHaveFocus();
  });

  it("names the task dialog close button in the interface language", async () => {
    await i18next.changeLanguage("pl");

    try {
      renderLesson(activeLesson);
      await screen.findByRole("dialog");
      expect(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();
    } finally {
      await i18next.changeLanguage("en");
    }
  });
});
