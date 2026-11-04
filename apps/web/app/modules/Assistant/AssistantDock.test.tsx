import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { helpdeskTutorialFixture } from "~/modules/SelfOnboarding/__tests__/fixtures";
import { server } from "~/utils/mocks/node";
import { renderWith } from "~/utils/testUtils";

import { AssistantDock } from "./AssistantDock";
import { AssistantMarkdown } from "./components/AssistantMarkdown";
import { assistantSessionKey, writeAssistantSelection } from "./useAssistantSession";

import type { CurrentUserResponse } from "~/api/generated-api";

const state = vi.hoisted(() => ({
  thread: { id: "11111111-1111-4111-8111-111111111111", title: "Feedback", archived: false },
  showHelpdesk: false,
}));
vi.mock("~/components/VideoPlayer/VideoPlayer", () => ({
  VideoPlayer: () => <div data-testid="floating-help-video" />,
}));
vi.mock("~/api/queries/assistant/useAssistantThread", () => ({
  useAssistantThread: () => ({
    data: state.thread,
    isSuccess: true,
    isFetching: false,
    error: null,
  }),
}));
vi.mock("./components/AssistantConversation", () => ({
  AssistantConversation: ({
    initialDraft,
    onDraftChange,
  }: {
    initialDraft: string;
    onDraftChange: (text: string) => void;
  }) => {
    const [draft, setDraft] = useState(initialDraft);
    return (
      <>
        <textarea
          aria-label="Mini draft"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onDraftChange(event.target.value);
          }}
        />
        {state.showHelpdesk && (
          <AssistantMarkdown
            text={`Watch [the tutorial](/helpdesk/tutorials/${helpdeskTutorialFixture.key}?chapter=review).`}
            sources={[
              {
                title: "Review publication",
                url: `/helpdesk/tutorials/${helpdeskTutorialFixture.key}?chapter=review`,
                entityType: "helpdesk",
              },
            ]}
          />
        )}
      </>
    );
  },
}));
const actor = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as CurrentUserResponse["data"];
const key = () => assistantSessionKey(actor, window.location.origin);
function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <button onClick={() => navigate("/assistant")}>Full page</button>
      <button onClick={() => navigate("/courses")}>Courses</button>
      <output data-testid="location">
        {location.pathname}:{(location.state as { draft?: string } | null)?.draft}
      </output>
    </>
  );
}
const renderDock = (path = "/courses", user = actor) =>
  renderWith({ withQuery: true }).render(
    <MemoryRouter initialEntries={[path]}>
      <Navigation />
      <AssistantDock actor={user} />
    </MemoryRouter>,
  );
beforeEach(() => {
  window.sessionStorage.clear();
  state.thread.archived = false;
  state.showHelpdesk = false;
});

describe("Assistant floating conversation", () => {
  it("closes the tutorial popup with Escape while retaining the floating conversation and draft", async () => {
    const user = userEvent.setup();
    state.showHelpdesk = true;
    useLanguageStore.setState({ language: "en" });
    server.use(
      http.get("*/api/helpdesk/tutorials/:key", () =>
        HttpResponse.json({ data: helpdeskTutorialFixture }),
      ),
      http.post("*/api/helpdesk/search", () =>
        HttpResponse.json({ data: { mode: "browse", results: [] } }),
      ),
    );
    window.sessionStorage.setItem(key(), state.thread.id);
    renderDock();
    fireEvent.click(await screen.findByTestId("assistant-floating-bubble"));
    const panel = await screen.findByTestId("assistant-floating-panel");
    fireEvent.change(within(panel).getByRole("textbox"), { target: { value: "Keep this draft" } });
    const citation = within(panel).getByRole("link", { name: "the tutorial" });
    await user.click(citation);
    await screen.findByTestId("floating-help-video");
    const popup = screen.getByRole("dialog", { name: "Publish a course" });
    expect(popup).toHaveClass("z-[81]");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByTestId("floating-help-video")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("assistant-floating-panel")).toBe(panel);
    expect(within(panel).getByRole("textbox")).toHaveValue("Keep this draft");
    expect(citation).toHaveFocus();
    expect(screen.getByTestId("location")).toHaveTextContent("/courses:");
  });

  it("appears only off the full Assistant page when a validated selection exists", async () => {
    window.sessionStorage.setItem(key(), state.thread.id);
    renderDock("/assistant");
    expect(screen.queryByTestId("assistant-floating-bubble")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Courses" }));
    expect(await screen.findByTestId("assistant-floating-bubble")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Full page" }));
    expect(screen.queryByTestId("assistant-floating-bubble")).not.toBeInTheDocument();
  });
  it("does not show a bubble for another account or without a selection", () => {
    window.sessionStorage.setItem(key(), state.thread.id);
    renderDock("/courses", { ...actor, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
    expect(screen.queryByTestId("assistant-floating-bubble")).not.toBeInTheDocument();
  });
  it("opens the same conversation, retains a minimized draft and carries it to full screen", async () => {
    window.sessionStorage.setItem(key(), state.thread.id);
    renderDock();
    fireEvent.click(await screen.findByTestId("assistant-floating-bubble"));
    const panel = await screen.findByRole("dialog", { name: "Assistant conversation" });
    fireEvent.change(within(panel).getByRole("textbox"), { target: { value: "Keep this draft" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Minimize conversation" }));
    fireEvent.click(screen.getByTestId("assistant-floating-bubble"));
    expect(screen.getByRole("textbox")).toHaveValue("Keep this draft");
    fireEvent.click(screen.getByRole("button", { name: "Open full Assistant" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      `/assistant/${state.thread.id}:Keep this draft`,
    );
    expect(screen.queryByTestId("assistant-floating-bubble")).not.toBeInTheDocument();
  });
  it("hides the bubble without clearing its session and re-enables it after a full-page visit", async () => {
    window.sessionStorage.setItem(key(), state.thread.id);
    renderDock();
    fireEvent.keyDown(await screen.findByTestId("assistant-floating-bubble"), { key: "Delete" });
    expect(screen.queryByTestId("assistant-floating-bubble")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(key())).toBe(state.thread.id);
    fireEvent.click(screen.getByRole("button", { name: "Full page" }));
    fireEvent.click(screen.getByRole("button", { name: "Courses" }));
    expect(await screen.findByTestId("assistant-floating-bubble")).toBeVisible();
  });
  it("reacts to same-tab selection changes and discards archived selections", async () => {
    renderDock();
    fireEvent.click(screen.getByRole("button", { name: "Courses" }));
    act(() => writeAssistantSelection(key(), state.thread.id));
    expect(await screen.findByTestId("assistant-floating-bubble")).toBeVisible();
    act(() => writeAssistantSelection(key(), null));
    await waitFor(() =>
      expect(screen.queryByTestId("assistant-floating-bubble")).not.toBeInTheDocument(),
    );
  });
  it("preserves open and minimized state across layout remounts", async () => {
    window.sessionStorage.setItem(key(), state.thread.id);
    const first = renderDock();
    fireEvent.click(await screen.findByTestId("assistant-floating-bubble"));
    expect(await screen.findByRole("dialog")).toBeVisible();
    first.unmount();
    const second = renderDock("/admin/users");
    const restored = await screen.findByRole("dialog");
    fireEvent.click(within(restored).getByRole("button", { name: "Minimize conversation" }));
    second.unmount();
    renderDock("/course/example/lesson/example");
    await screen.findByTestId("assistant-floating-bubble");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(key())).toBe(state.thread.id);
  });

  it("starts bottom-right instead of restoring a legacy center position", async () => {
    window.sessionStorage.setItem(key(), state.thread.id);
    window.sessionStorage.setItem(`${key()}:dock-position`, JSON.stringify({ x: 300, y: 400 }));
    renderDock();
    const bubble = await screen.findByTestId("assistant-floating-bubble");
    await waitFor(() =>
      expect(bubble.style.transform).toContain(`translateX(${window.innerWidth - 80}px)`),
    );
    expect(bubble.style.transform).toContain(`translateY(${window.innerHeight - 80}px)`);
  });

  it("remembers a moved position across layout remounts", async () => {
    window.sessionStorage.setItem(key(), state.thread.id);
    const first = renderDock();
    fireEvent.keyDown(await screen.findByTestId("assistant-floating-bubble"), { key: "ArrowLeft" });
    const saved = JSON.parse(window.sessionStorage.getItem(`${key()}:dock-position:v2`)!);
    first.unmount();
    renderDock("/admin/users");
    const restored = await screen.findByTestId("assistant-floating-bubble");
    await waitFor(() => expect(restored.style.transform).toContain(`translateX(${saved.x}px)`));
    expect(restored.style.transform).toContain(`translateY(${saved.y}px)`);
  });

  it("clears archived selection without showing its conversation", async () => {
    state.thread.archived = true;
    window.sessionStorage.setItem(key(), state.thread.id);
    renderDock();
    await waitFor(() => expect(window.sessionStorage.getItem(key())).toBeNull());
    expect(screen.queryByTestId("assistant-floating-bubble")).not.toBeInTheDocument();
  });
});
