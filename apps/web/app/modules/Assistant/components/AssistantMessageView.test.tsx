import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AssistantMessageView } from "./AssistantMessageView";

import type { AssistantMessage } from "../assistant.types";
import type { ReactElement } from "react";

vi.mock("~/api/queries", () => ({
  useCurrentUserSuspense: () => ({
    data: { firstName: "Alex", lastName: "Learner", profilePictureUrl: null },
  }),
}));

const renderView = (element: ReactElement) => {
  const result = renderWith().render(<MemoryRouter>{element}</MemoryRouter>);
  return {
    ...result,
    rerender: (next: ReactElement) => result.rerender(<MemoryRouter>{next}</MemoryRouter>),
  };
};

const message: AssistantMessage = {
  id: "m1",
  threadId: "t1",
  role: "assistant",
  text: "See [Onboarding](/courses/onboarding) or [unverified](https://example.org).",
  status: "complete",
  sources: [{ title: "Onboarding", url: "/courses/onboarding" }],
  createdAt: "2026-10-22T10:00:00Z",
};

describe("AssistantMessageView", () => {
  it("only makes evidence-backed links clickable", () => {
    renderView(<AssistantMessageView message={message} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByText("unverified").closest("a")).toBeNull();
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/courses/onboarding");
  });

  it("keeps person previews inline without a redundant Sources section", async () => {
    const user = userEvent.setup();
    renderView(
      <AssistantMessageView
        message={{
          ...message,
          text: "Found [Audrey Student](/admin/users/student-1).",
          sources: [{ title: "Audrey Student", url: "/admin/users/student-1", entityType: "user" }],
        }}
      />,
    );
    const links = screen.getAllByRole("link", { name: /Audrey Student/ });
    expect(links).toHaveLength(1);
    await user.hover(links[0]);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Person");
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Audrey Student");
  });

  it("shows reading materials separately while excluding people and administrative records", () => {
    renderView(
      <AssistantMessageView
        message={{
          ...message,
          sources: [
            ...message.sources,
            { title: "Ada", url: "/admin/users/ada" },
            { title: "Team", url: "/admin/groups/team", entityType: "group" },
            { title: "Topic", url: "/admin/categories/topic", entityType: "category" },
            { title: "Guide", url: "/articles/guide", entityType: "article" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Sources")).toBeVisible();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Onboarding",
      "Onboarding",
      "Guide",
    ]);
  });

  it("keeps an inline preview open when polling rerenders the message", async () => {
    const user = userEvent.setup();
    const view = renderView(<AssistantMessageView message={message} />);
    await user.hover(screen.getAllByRole("link", { name: "Onboarding" })[0]);
    const preview = await screen.findByRole("dialog");
    view.rerender(<AssistantMessageView message={{ ...message, sources: [...message.sources] }} />);
    expect(preview).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBe(preview);
  });

  it("does not fetch markdown images or expose unsafe source protocols", () => {
    renderView(
      <AssistantMessageView
        message={{
          ...message,
          text: "![tracking](https://example.org/pixel)",
          sources: [{ title: "Unsafe", url: "javascript:alert(1)" }],
        }}
      />,
    );
    expect(document.querySelector('img[src="https://example.org/pixel"]')).toBeNull();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders real activity changes while a reply is running", () => {
    const pending = { ...message, text: "", status: "running" as const };
    const view = renderView(<AssistantMessageView message={pending} activity="searching" />);
    expect(screen.getByRole("status")).toHaveTextContent("Searching your workspace…");
    view.rerender(<AssistantMessageView message={pending} activity="reading" />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading the content…");
    view.rerender(
      <AssistantMessageView
        message={{ ...pending, text: "Yo!", status: "complete" }}
        activity="writing"
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("labels older queued replies while progress metadata is absent", () => {
    renderView(<AssistantMessageView message={{ ...message, text: "", status: "pending" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Starting…");
  });

  it("preserves partial text with a visible failure status", () => {
    renderView(
      <AssistantMessageView message={{ ...message, text: "Partial answer", status: "failed" }} />,
    );
    expect(screen.getByText("Partial answer")).toBeVisible();
    expect(screen.getByRole("status")).toBeVisible();
  });
});
