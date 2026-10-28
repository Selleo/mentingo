import { createRemixStub } from "@remix-run/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { server } from "~/utils/mocks/node";
import { renderWith } from "~/utils/testUtils";

import { helpdeskHitFixture } from "./__tests__/fixtures";
import HelpdeskContent from "./HelpdeskContent";

function setup() {
  const onSelect = vi.fn();
  const onAskAssistant = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const App = createRemixStub([
    { path: "/assistant", Component: () => <h1>Real assistant workspace</h1> },
    {
      path: "/admin/beta-courses/:id/authoring",
      Component: () => <HelpdeskContent onSelect={onSelect} onAskAssistant={onAskAssistant} />,
    },
  ]);
  renderWith().render(
    <QueryClientProvider client={client}>
      <App initialEntries={["/admin/beta-courses/private-course-id/authoring"]} />
    </QueryClientProvider>,
  );
  return { onSelect, onAskAssistant };
}

beforeEach(() => {
  useLanguageStore.setState({ language: "en" });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Helpdesk public tutorial search", () => {
  it("sends only symbolic page context and opens the returned chapter timestamp", async () => {
    const requests: unknown[] = [];
    server.use(
      http.post("*/api/helpdesk/search", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({ data: { mode: "hybrid", results: [helpdeskHitFixture] } });
      }),
    );
    const { onSelect } = setup();
    fireEvent.click(await screen.findByRole("button", { name: /Publish a course/ }));
    expect(onSelect).toHaveBeenCalledWith({
      tutorial: helpdeskHitFixture.tutorial,
      startMs: 12_345,
    });
    expect(requests).toEqual([
      { query: "", language: "en", pageKey: "admin.course.curriculum", limit: 8 },
    ]);
    expect(JSON.stringify(requests)).not.toContain("private-course-id");
    expect(screen.queryByText(/preview|example results/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Course editing" })).not.toBeInTheDocument();
  });

  it("debounces edited searches and shows honest no-match results", async () => {
    const requests: unknown[] = [];
    server.use(
      http.post("*/api/helpdesk/search", async ({ request }) => {
        const body = await request.json();
        requests.push(body);
        return HttpResponse.json({ data: { mode: "hybrid", results: [] } });
      }),
    );
    setup();
    await screen.findByText("No tutorials found");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " p " } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " publish " } });
    expect(requests).toHaveLength(1);
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toEqual({
      query: "publish",
      language: "en",
      pageKey: "admin.course.curriculum",
      limit: 8,
    });
    expect(await screen.findByText("No tutorials found")).toBeInTheDocument();
  });

  it("explains real keyword fallback and offers a retry for service errors", async () => {
    server.use(
      http.post("*/api/helpdesk/search", () =>
        HttpResponse.json({ message: "helpdesk.errors.versionUnavailable" }, { status: 503 }),
      ),
    );
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Help is not available for this version of Mentingo yet.",
    );
    expect(screen.queryByText("No tutorials found")).not.toBeInTheDocument();
    server.use(
      http.post("*/api/helpdesk/search", () =>
        HttpResponse.json({ data: { mode: "keyword_fallback", results: [helpdeskHitFixture] } }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /Publish a course/ })).toBeInTheDocument();
    expect(
      screen.getByText("Showing keyword matches while AI search is unavailable."),
    ).toBeInTheDocument();
  });

  it("opens the existing assistant workspace", async () => {
    server.use(
      http.post("*/api/helpdesk/search", () =>
        HttpResponse.json({ data: { mode: "browse", results: [] } }),
      ),
    );
    const { onAskAssistant } = setup();
    fireEvent.click(await screen.findByRole("link", { name: /Ask the assistant/ }));
    expect(
      await screen.findByRole("heading", { name: "Real assistant workspace" }),
    ).toBeInTheDocument();
    expect(onAskAssistant).toHaveBeenCalledOnce();
  });
});
