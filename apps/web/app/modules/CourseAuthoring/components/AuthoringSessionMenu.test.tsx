import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringSessionMenu } from "./AuthoringSessionMenu";

import type { AuthoringSessionSummary } from "../courseAuthoring.types";

const session = (id: string, title: string, status: AuthoringSessionSummary["status"]) => ({
  sessionId: id,
  courseId: "course",
  language: "en" as const,
  status,
  title,
  createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  lastActivityAt: new Date(Date.now() - 3_600_000).toISOString(),
});

const renderMenu = (overrides: Partial<Parameters<typeof AuthoringSessionMenu>[0]> = {}) => {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    sessions: [session("a", "Intro rewrite", "active"), session("b", "Quiz pass", "paused")],
    selectedSessionId: "a",
    selectedTitle: "Intro rewrite",
    search: "",
    onSearchChange: vi.fn(),
    onSelect: vi.fn(),
    onNewChat: vi.fn(),
    creating: false,
    loading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    onLoadMore: vi.fn(),
    ...overrides,
  };
  renderWith()
    .withI18n()
    .render(<AuthoringSessionMenu {...props} />);
  return props;
};

describe("AuthoringSessionMenu", () => {
  it("marks the current chat and shows activity time and non-active status", () => {
    renderMenu();
    const list = screen.getByTestId("course-authoring-session-menu-list");
    const current = within(list).getByTestId("course-authoring-session-menu-item-a");
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveTextContent(/ago/);
    expect(within(list).getByTestId("course-authoring-session-menu-item-b")).toHaveTextContent(
      "Paused",
    );
  });

  it("offers a labelled new chat action and selects a chat", async () => {
    const user = userEvent.setup();
    const props = renderMenu();
    await user.click(screen.getByTestId("course-authoring-new-chat-button"));
    expect(props.onNewChat).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText("Quiz pass"));
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "b" }));
  });

  it("does not start a second chat while one is being created", async () => {
    const user = userEvent.setup();
    const props = renderMenu({ creating: true });
    await user.click(screen.getByTestId("course-authoring-new-chat-button"));
    expect(props.onNewChat).not.toHaveBeenCalled();
  });
});
