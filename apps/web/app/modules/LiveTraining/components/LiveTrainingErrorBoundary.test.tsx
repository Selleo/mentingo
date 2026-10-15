import { createRemixStub } from "@remix-run/testing";
import { render, screen } from "@testing-library/react";
import { AxiosError } from "axios";
import { Component } from "react";

import { queryClient } from "~/api/queryClient";

import { LiveTrainingErrorBoundary } from "./LiveTrainingErrorBoundary";

import type { AxiosResponse } from "axios";
import type { ReactNode } from "react";

const queryKey = ["live-training-redirect-test"];

function ThrowError({ error }: { error: unknown }): never {
  throw error;
}

class OuterErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <p>Route error</p>;
    return this.props.children;
  }
}

function renderError(error: unknown) {
  const RemixStub = createRemixStub([
    {
      path: "/live-training/test",
      Component: () => (
        <OuterErrorBoundary>
          <LiveTrainingErrorBoundary queryKey={queryKey}>
            <ThrowError error={error} />
          </LiveTrainingErrorBoundary>
        </OuterErrorBoundary>
      ),
    },
    { path: "/calendar", Component: () => <p>Calendar destination</p> },
    { path: "/", Component: () => <p>Dashboard destination</p> },
  ]);
  return render(<RemixStub initialEntries={["/live-training/test"]} />);
}

async function storeQueryFailure(error: unknown) {
  await queryClient
    .fetchQuery({ queryKey, queryFn: () => Promise.reject(error), retry: false })
    .catch(() => undefined);
}

describe("live training route query boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    queryClient.removeQueries({ queryKey });
    vi.restoreAllMocks();
  });

  it("navigates a forbidden query failure to the dashboard", async () => {
    const error = new AxiosError("Forbidden", undefined, undefined, undefined, {
      status: 403,
    } as AxiosResponse);
    await storeQueryFailure(error);
    renderError(error);
    expect(await screen.findByText("Dashboard destination")).toBeInTheDocument();
  });

  it("navigates a non-HTTP query failure to the calendar", async () => {
    const error = new Error("Malformed training response");
    await storeQueryFailure(error);
    renderError(error);
    expect(await screen.findByText("Calendar destination")).toBeInTheDocument();
  });

  it("keeps UI failures in the route error boundary", async () => {
    renderError(new Error("UI rendering failed"));
    expect(await screen.findByText("Route error")).toBeInTheDocument();
    expect(screen.queryByText("Calendar destination")).not.toBeInTheDocument();
  });
});
