import { createRemixStub } from "@remix-run/testing";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import AiConversationsPage from "./AiConversations.page";

const listState = vi.hoisted(() => ({ empty: false }));

vi.mock("~/api/queries/admin/useAdminAiThread", () => ({
  useAdminAiThread: (id: string) => ({
    data: {
      id,
      title: `Conversation ${id}`,
      owner: { firstName: "Alex", lastName: "Learner" },
      type: "practice",
      status: "completed",
      language: "en",
      createdAt: "2026-09-10T10:00:00Z",
      lastActivityAt: "2026-09-10T10:05:00Z",
      evaluation: null,
    },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("~/api/queries/admin/useAdminAiThreadMessages", () => ({
  useAdminAiThreadMessages: () => ({
    data: { pages: [{ data: [] }] },
    isPending: false,
    isError: false,
    hasNextPage: false,
  }),
}));

vi.mock("~/api/queries/admin/useAdminAiThreads", () => ({
  useAdminAiThreads: () => ({
    data: {
      data: (listState.empty ? [] : ["active", "completed", "archived"]).map((status) => ({
        id: status,
        title: `Conversation ${status}`,
        openingPreview: "Welcome",
        owner: { firstName: "Alex", lastName: "Learner", profilePictureUrl: "/avatar.png" },
        type: "practice",
        courseTitle: null,
        status,
        lastActivityAt: "2026-09-10T10:00:00Z",
      })),
      pagination: { totalItems: listState.empty ? 0 : 3 },
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

const Page = createRemixStub([
  { path: "/admin/ai-conversations/:threadId?", Component: AiConversationsPage },
]);

describe("AI conversations inbox", () => {
  beforeEach(() => {
    listState.empty = false;
  });
  afterEach(() => vi.useRealTimers());
  it("clears a pending toolbar search together with popup filters", async () => {
    renderWith().render(<Page initialEntries={["/admin/ai-conversations?status=archived"]} />);
    await screen.findByTestId("admin-ai-conversation-active");
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByTestId("admin-ai-conversations-search"), {
      target: { value: "pending" },
    });
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByTestId("admin-ai-conversations-search")).toHaveValue("");
    expect(screen.getByTestId("admin-ai-conversation-active")).toHaveAttribute(
      "href",
      "/admin/ai-conversations/active",
    );
  });
  it.each(["", "?search=missing"])(
    "does not ask to select a conversation from empty results (%s)",
    async (search) => {
      listState.empty = true;
      renderWith().render(<Page initialEntries={[`/admin/ai-conversations${search}`]} />);
      await screen.findByRole("heading", { name: "AI conversations" });
      expect(screen.queryByText("Select a conversation")).not.toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    },
  );
  it("preserves list URL state and resets details when selecting another conversation", async () => {
    renderWith().render(
      <Page initialEntries={["/admin/ai-conversations?status=archived&page=2"]} />,
    );
    const first = await screen.findByTestId("admin-ai-conversation-active");
    expect(first).toHaveAttribute("href", "/admin/ai-conversations/active?status=archived&page=2");
    fireEvent.click(first);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Details" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByRole("tabpanel", { name: "Details" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("admin-ai-conversation-completed"));
    await waitFor(() =>
      expect(screen.getByTestId("admin-ai-conversation-completed")).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    expect(screen.getByRole("tabpanel", { name: "Conversation" })).toBeInTheDocument();
    expect(screen.queryByRole("tabpanel", { name: "Details" })).not.toBeInTheDocument();
  });
  it("shows selectable conversations and a choose-conversation state without avatars or refresh", async () => {
    renderWith().render(<Page initialEntries={["/admin/ai-conversations"]} />);
    const heading = await screen.findByRole("heading", { level: 1, name: "AI conversations" });
    expect(screen.getByTestId("admin-ai-conversations")).not.toContainElement(heading);
    expect(await screen.findByText("Select a conversation")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getAllByRole("combobox")).toHaveLength(1); // Page size; filters open separately.
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("Practice session")).not.toBeInTheDocument();
    expect(screen.getByText("In progress")).toHaveClass("text-warning-800");
    expect(screen.getByText("Completed")).toHaveClass("text-success-700");
    expect(screen.getByText("Archived")).toHaveClass("text-neutral-500");
  });
});
