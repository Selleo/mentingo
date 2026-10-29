import { createRemixStub } from "@remix-run/testing";
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { ConversationReader } from "./ConversationReader";

const loading = vi.hoisted(() => ({
  threadPending: false,
  messagesPending: false,
  background: false,
  failed: false,
  slack: false,
}));
vi.mock("~/api/queries/admin/useAdminAiThread", () => ({
  useAdminAiThread: () => ({
    data: loading.threadPending
      ? undefined
      : {
          id: "thread",
          title: "Saved interview",
          owner: { firstName: "Alex", lastName: "Learner", profilePictureUrl: null },
          type: loading.slack ? "assistant" : "practice",
          source: loading.slack ? "slack" : "mentingo",
          courseTitle: null,
          status: "completed",
          language: "en",
          createdAt: "2026-09-10T10:00:00Z",
          lastActivityAt: "2026-09-10T10:05:00Z",
          evaluation: {
            passed: true,
            score: 8,
            maxScore: 10,
            percentage: 80,
            criteria: [],
            blockingErrors: [],
          },
        },
    isPending: loading.threadPending,
    isFetching: loading.background,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("~/api/queries/admin/useAdminAiThreadMessages", () => ({
  useAdminAiThreadMessages: () => ({
    data: {
      pages: [
        {
          data: [
            ...(loading.slack
              ? [
                  {
                    id: "slack-named",
                    role: "user",
                    content: "Named message",
                    slackUserId: "U123",
                    slackUserName: "Jamie Slack",
                  },
                  { id: "slack-id", role: "user", content: "ID-only message", slackUserId: "U456" },
                  { id: "slack-unknown", role: "user", content: "Unknown sender" },
                ]
              : []),
            ...(loading.failed
              ? [
                  {
                    id: "failed",
                    role: "assistant",
                    content: "Saved partial answer",
                    status: "failed",
                  },
                ]
              : []),
            ...(loading.background
              ? [{ id: "saved", role: "assistant", content: "Previously loaded message" }]
              : []),
          ],
        },
      ],
    },
    isPending: loading.messagesPending,
    isFetching: loading.background,
    isError: false,
    hasNextPage: false,
  }),
}));
vi.mock("~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage", () => ({
  default: ({
    content,
    userName,
    previewUser,
  }: {
    content: string;
    userName: string;
    previewUser: { profilePictureUrl: string | null };
  }) => (
    <div data-avatar={previewUser.profilePictureUrl}>
      <span>{userName}</span>
      <p>{content}</p>
    </div>
  ),
}));

const Page = createRemixStub([
  {
    path: "/",
    Component: () => <ConversationReader threadId="thread" language="en" search="?page=2" />,
  },
]);

describe("conversation details", () => {
  beforeEach(() => {
    loading.threadPending = false;
    loading.messagesPending = false;
    loading.background = false;
    loading.failed = false;
    loading.slack = false;
  });

  it("identifies Slack and attributes each message to its participant", async () => {
    loading.slack = true;
    renderWith().render(<Page />);
    expect(await screen.findByRole("img", { name: "Slack" })).toBeInTheDocument();
    expect(screen.getByText("Connected account: Alex Learner")).toBeInTheDocument();
    expect(screen.getByText("Jamie Slack")).toBeInTheDocument();
    expect(screen.getByText("U456")).toBeInTheDocument();
    expect(screen.getByText("Slack participant")).toBeInTheDocument();
    expect(screen.queryByText("U123")).not.toBeInTheDocument();
  });

  it.each([true, false])(
    "uses one quiet loading status without an Untitled flash (metadata pending: %s)",
    async (threadPending) => {
      loading.threadPending = threadPending;
      loading.messagesPending = true;
      renderWith().render(<Page />);
      expect(await screen.findAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveClass("sr-only");
      expect(screen.queryByText("Untitled conversation")).not.toBeInTheDocument();
      expect(screen.queryByText("No messages in this conversation yet.")).not.toBeInTheDocument();
    },
  );

  it("keeps saved messages visible while fetching in the background", async () => {
    loading.background = true;
    renderWith().render(<Page />);
    expect(await screen.findByText("Previously loaded message")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("preserves a partial assistant response and identifies its failed status", async () => {
    loading.failed = true;
    renderWith().render(<Page />);
    expect(await screen.findByText("Saved partial answer")).toBeInTheDocument();
    expect(screen.getByText("Interrupted by an error")).toBeInTheDocument();
  });

  it("opens details in its tab and shows saved evaluation in a dialog", async () => {
    renderWith().render(<Page />);
    expect(await screen.findByRole("tab", { name: "Details" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View evaluation" })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Details" }), {
      button: 0,
      ctrlKey: false,
    });
    const details = screen.getByRole("tabpanel", { name: "Details" });
    expect(within(details).getByText("Alex Learner")).toBeInTheDocument();
    expect(within(details).getByText("English")).toBeInTheDocument();
    expect(within(details).getByText("Practice session")).toBeInTheDocument();
    fireEvent.click(within(details).getByRole("button", { name: "View evaluation" }));
    expect(screen.queryByRole("dialog", { name: "Details" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveTextContent("8");
  });

  it("switches back to the conversation without opening a details overlay", async () => {
    renderWith().render(<Page />);
    const details = await screen.findByRole("tab", { name: "Details" });
    fireEvent.mouseDown(details, { button: 0, ctrlKey: false });
    expect(screen.getByRole("tabpanel", { name: "Details" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Conversation" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByRole("tabpanel", { name: "Conversation" })).toBeInTheDocument();
    expect(screen.queryByRole("tabpanel", { name: "Details" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to conversations" })).toHaveAttribute(
      "href",
      "/admin/ai-conversations?page=2",
    );
  });
});
