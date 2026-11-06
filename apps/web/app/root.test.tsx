import { createRemixStub } from "@remix-run/testing";
import { QueryClientProvider, useSuspenseQuery } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryClient } from "~/api/queryClient";

import Root from "./root";

import type { ReactNode } from "react";

vi.mock("~/hooks/useNavigationTracker", () => ({ useNavigationTracker: vi.fn() }));
vi.mock("~/components/PlatformFavicon", () => ({ PlatformFavicon: () => null }));
vi.mock("~/modules/Global/Providers", () => ({
  Providers: ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ),
}));
vi.mock("~/modules/Global/ThemeWrapper", () => ({
  ThemeWrapper: ({ children }: { children: ReactNode }) => children,
}));

describe("Route loading boundary", () => {
  afterEach(() => queryClient.clear());

  it("handles a mounted query suspending after the authentication cache reset", async () => {
    let resolveSettings: (value: string) => void = () => undefined;
    const settingsRequest = new Promise<string>((resolve) => {
      resolveSettings = resolve;
    });
    const queryOptions = {
      queryKey: ["auth-transition-settings"],
      queryFn: () => settingsRequest,
      staleTime: Infinity,
    };
    queryClient.setQueryData(queryOptions.queryKey, "Cached settings");

    function LoginScreen() {
      const [submitted, setSubmitted] = useState(false);
      const { data } = useSuspenseQuery(queryOptions);
      return (
        <button
          onClick={() => {
            queryClient.clear();
            setSubmitted(true);
          }}
        >
          {submitted ? data : "Sign in"}
        </button>
      );
    }

    const App = createRemixStub([
      {
        path: "/",
        Component: Root,
        ErrorBoundary: () => <div>Route crashed</div>,
        children: [{ index: true, Component: LoginScreen }],
      },
    ]);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));

    expect(screen.queryByText("Route crashed")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => resolveSettings("Reloaded settings"));
    expect(await screen.findByRole("button", { name: "Reloaded settings" })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
