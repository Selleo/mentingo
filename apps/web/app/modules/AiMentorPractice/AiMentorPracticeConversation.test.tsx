import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCurrentThreadMessages } from "~/api/queries/useCurrentThreadMessages";
import { renderWith } from "~/utils/testUtils";

import { AiMentorPracticeConversation } from "./AiMentorPracticeConversation";

import type { AiMentorPracticeComposer } from "./components/AiMentorPracticeComposer";
import type { UIMessage } from "@ai-sdk/react";
import type { ComponentProps, ReactNode } from "react";

const mounts = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock("@ai-sdk/react", async () => {
  const { useState } = await import("react");
  return {
    useChat: () => {
      const [messages, setMessages] = useState<UIMessage[]>([]);
      return { messages, setMessages, sendMessage: vi.fn(), status: "ready" };
    },
  };
});
vi.mock("~/api/queries/useCurrentThreadMessages", () => ({
  useCurrentThreadMessages: vi.fn(),
  getCurrentThreadMessagesQueryKey: (threadId: string) => ["threadMessages", { threadId }],
}));
vi.mock("~/api/mutations/useJudgePractice", () => ({
  useJudgePractice: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("~/api/mutations/useReplayAiMentorPractice", () => ({
  useReplayAiMentorPractice: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./components/AiMentorPracticeHeader", () => ({ AiMentorPracticeHeader: () => null }));
vi.mock("./components/AiMentorPracticeMessages", () => ({
  AiMentorPracticeMessages: ({ messages }: { messages: UIMessage[] }) => (
    <div>
      {messages.map((message) => (
        <div key={message.id} data-testid="message">
          {message.parts.map((part) => part.type === "text" && part.text)}
        </div>
      ))}
    </div>
  ),
}));
vi.mock("./components/AiMentorPracticeComposer", async () => {
  const { useEffect, useRef } = await import("react");
  return {
    AiMentorPracticeComposer: ({
      threadId,
      onLearnerTranscription,
    }: ComponentProps<typeof AiMentorPracticeComposer>) => {
      const initialThread = useRef(threadId);
      useEffect(() => {
        const mountedThread = initialThread.current;
        mounts.mount(mountedThread);
        return () => mounts.unmount(mountedThread);
      }, []);
      return (
        <button onClick={() => onLearnerTranscription("Spoken answer", "turn-1")}>
          Final transcription
        </button>
      );
    },
  };
});

const props = {
  id: "practice-1",
  threadId: "attempt-1",
  threadStatus: "active" as const,
  title: "Practice",
  aiMentorName: "Maya",
  taskGoal: null,
  evaluation: null,
};
const setHistory = (messages: Array<{ id: string; role: string; content: string }>) => {
  vi.mocked(useCurrentThreadMessages).mockReturnValue({
    data: { data: messages },
    isLoading: false,
  } as ReturnType<typeof useCurrentThreadMessages>);
};

beforeEach(() => {
  vi.clearAllMocks();
  setHistory([{ id: "welcome", role: "assistant", content: "Welcome" }]);
});

describe("Practice voice history", () => {
  it("deduplicates final transcript events and replaces local history with persisted messages", async () => {
    const { rerender } = renderWith().render(<AiMentorPracticeConversation {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Final transcription" }));
    fireEvent.click(screen.getByRole("button", { name: "Final transcription" }));
    expect(screen.getAllByText("Spoken answer")).toHaveLength(1);
    setHistory([
      { id: "welcome", role: "assistant", content: "Welcome" },
      { id: "saved-user", role: "user", content: "Spoken answer" },
      { id: "saved-mentor", role: "assistant", content: "Persisted reply" },
    ]);
    rerender(<AiMentorPracticeConversation {...props} />);
    await waitFor(() => expect(screen.getByText("Persisted reply")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Final transcription" }));
    expect(screen.getAllByText("Spoken answer")).toHaveLength(1);
  });

  it("unmounts the old voice composer when replay replaces the thread", async () => {
    const { rerender } = renderWith().render(<AiMentorPracticeConversation {...props} />);
    setHistory([{ id: "new-welcome", role: "assistant", content: "New attempt" }]);
    rerender(<AiMentorPracticeConversation {...props} threadId="attempt-2" />);
    await waitFor(() => expect(screen.getByText("New attempt")).toBeInTheDocument());
    expect(mounts.unmount).toHaveBeenCalledWith("attempt-1");
    expect(mounts.mount).toHaveBeenCalledWith("attempt-2");
    expect(screen.queryByText("Welcome")).not.toBeInTheDocument();
  });
});
