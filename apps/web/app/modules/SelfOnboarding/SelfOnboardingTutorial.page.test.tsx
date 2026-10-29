import { createRemixStub } from "@remix-run/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { server } from "~/utils/mocks/node";
import { renderWith } from "~/utils/testUtils";

import { helpdeskTutorialFixture } from "./__tests__/fixtures";
import HelpdeskTutorialPage from "./SelfOnboardingTutorial.page";

vi.mock("~/components/VideoPlayer/VideoPlayer", () => ({
  VideoPlayer: ({ seekTo }: { seekTo: number }) => (
    <div data-testid="helpdesk-player" data-seek={seekTo} />
  ),
}));

function setup(chapter: string) {
  useLanguageStore.setState({ language: "en" });
  server.use(
    http.get("*/api/helpdesk/tutorials/:key", () =>
      HttpResponse.json({ data: helpdeskTutorialFixture }),
    ),
    http.post("*/api/helpdesk/search", () =>
      HttpResponse.json({ data: { mode: "browse", results: [] } }),
    ),
  );
  const App = createRemixStub([
    { path: "/helpdesk/tutorials/:key", Component: HelpdeskTutorialPage },
  ]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderWith().render(
    <QueryClientProvider client={client}>
      <App
        initialEntries={[`/helpdesk/tutorials/${helpdeskTutorialFixture.key}?chapter=${chapter}`]}
      />
    </QueryClientProvider>,
  );
}

describe("Helpdesk tutorial deep links", () => {
  it("resolves the stable chapter ID into the server-provided timestamp", async () => {
    setup("review");
    expect(await screen.findByRole("heading", { name: "Publish a course" })).toBeInTheDocument();
    expect(screen.getByTestId("helpdesk-player")).toHaveAttribute("data-seek", "12.345");
  });
  it("handles a missing chapter honestly without inventing a seek position", async () => {
    setup("removed-chapter");
    expect(
      await screen.findByText(
        "This chapter is no longer available. Showing the video from the beginning.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("helpdesk-player")).toHaveAttribute("data-seek", "0");
  });
});
