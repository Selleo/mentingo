import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { helpdeskTutorialFixture } from "~/modules/Helpdesk/__tests__/fixtures";
import { server } from "~/utils/mocks/node";
import { renderWith } from "~/utils/testUtils";

import { AssistantMarkdown } from "./AssistantMarkdown";

import type { AssistantSource } from "../assistant.types";

vi.mock("~/components/VideoPlayer/VideoPlayer", () => ({
  VideoPlayer: ({ seekTo }: { seekTo: number }) => (
    <div data-testid="popup-player" data-seek={seekTo} />
  ),
}));

const source: AssistantSource = {
  title: "Review publication",
  url: `/helpdesk/tutorials/${helpdeskTutorialFixture.key}?chapter=review`,
  entityType: "helpdesk",
};

function CurrentLocation() {
  const { pathname, search } = useLocation();
  return (
    <output data-testid="conversation-location">
      {pathname}
      {search}
    </output>
  );
}

function setup(citation = source) {
  return renderWith({ withQuery: true }).render(
    <MemoryRouter initialEntries={["/assistant/current-conversation"]}>
      <AssistantMarkdown
        text={`Watch [the matching step](${citation.url}).`}
        sources={[citation]}
      />
      <CurrentLocation />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useLanguageStore.setState({ language: "en" });
  server.use(
    http.get("*/api/helpdesk/tutorials/:key", () =>
      HttpResponse.json({ data: helpdeskTutorialFixture }),
    ),
    http.post("*/api/helpdesk/search", () =>
      HttpResponse.json({ data: { mode: "browse", results: [] } }),
    ),
  );
});

describe("Assistant Helpdesk citations", () => {
  it("opens a verified chapter in a popup, preserves the conversation and restores focus", async () => {
    const user = userEvent.setup();
    const reads: string[] = [];
    server.use(
      http.get("*/api/helpdesk/tutorials/:key", ({ params }) => {
        reads.push(String(params.key));
        return HttpResponse.json({ data: helpdeskTutorialFixture });
      }),
    );
    setup();
    const link = screen.getByRole("link", { name: "the matching step" });
    expect(reads).toHaveLength(0);
    await user.click(link);
    const player = await screen.findByTestId("popup-player");
    expect(player).toHaveAttribute("data-seek", "12.345");
    expect(screen.getByTestId("conversation-location")).toHaveTextContent(
      "/assistant/current-conversation",
    );
    expect(reads).toEqual([helpdeskTutorialFixture.key]);
    expect(screen.queryByLabelText("Video timeline")).not.toBeInTheDocument();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /Prepare the course 0:00/ }),
    );
    expect(player).toHaveAttribute("data-seek", "0");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(link).toHaveFocus();
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("supports keyboard opening and handles a removed chapter inside the popup", async () => {
    const user = userEvent.setup();
    setup({ ...source, url: `/helpdesk/tutorials/${helpdeskTutorialFixture.key}?chapter=removed` });
    await user.tab();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByText(
        "This chapter is no longer available. Showing the video from the beginning.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("popup-player")).toHaveAttribute("data-seek", "0");
    expect(screen.getByTestId("conversation-location")).toHaveTextContent(
      "/assistant/current-conversation",
    );
  });

  it("keeps lookup failures and retry inside the same popup", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/helpdesk/tutorials/:key", () =>
        HttpResponse.json({ message: "helpdesk.errors.unavailable" }, { status: 503 }),
      ),
    );
    setup();
    await user.click(screen.getByRole("link", { name: "the matching step" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tutorials are temporarily unavailable.",
    );
    const dialog = screen.getByRole("dialog");
    server.use(
      http.get("*/api/helpdesk/tutorials/:key", () =>
        HttpResponse.json({ data: helpdeskTutorialFixture }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByTestId("popup-player");
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(screen.getByTestId("conversation-location")).toHaveTextContent(
      "/assistant/current-conversation",
    );
  });

  it("switches related videos inside the popup without leaving the conversation", async () => {
    const user = userEvent.setup();
    const related = {
      ...helpdeskTutorialFixture,
      key: "development-paths.create",
      revisionId: "40000000-0000-4000-8000-000000000000",
      title: "Create a path",
    };
    server.use(
      http.post("*/api/helpdesk/search", () =>
        HttpResponse.json({
          data: {
            mode: "browse",
            results: [{ tutorial: related, startMs: 0, endMs: related.durationMs, rankScore: 0 }],
          },
        }),
      ),
    );
    setup();
    await user.click(screen.getByRole("link", { name: "the matching step" }));
    await screen.findByTestId("popup-player");
    const dialog = screen.getByRole("dialog");
    await user.click(await screen.findByRole("button", { name: /Create a path/ }));
    expect(screen.getByRole("heading", { name: "Create a path" })).toBeInTheDocument();
    expect(screen.getByTestId("popup-player")).toHaveAttribute("data-seek", "0");
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(screen.getByTestId("conversation-location")).toHaveTextContent(
      "/assistant/current-conversation",
    );
  });

  it("does not turn a foreign Helpdesk URL into a popup or navigation action", () => {
    setup({ ...source, url: "https://other.example/helpdesk/tutorials/foreign" });
    expect(screen.getByText("the matching step")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
