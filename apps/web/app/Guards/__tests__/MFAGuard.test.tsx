import { createRemixStub } from "@remix-run/testing";
import { AUTH_SESSION_STATUS } from "@repo/shared";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthSession } from "~/api/queries/useAuthSession";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { renderWith } from "~/utils/testUtils";

import { MFAGuard } from "../MFAGuard";

import type { AuthSessionStatus } from "@repo/shared";

vi.mock("~/api/queries/useAuthSession");
vi.mock("~/api/queries/useCurrentUser");

describe("MFAGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  function renderSession(
    status: AuthSessionStatus | null | undefined,
    sessionError: Error | null = null,
  ) {
    vi.mocked(useAuthSession).mockReturnValue({
      data: status === undefined ? undefined : status && { status },
      isLoading: false,
      isError: Boolean(sessionError),
      error: sessionError,
    } as ReturnType<typeof useAuthSession>);
    vi.mocked(useCurrentUser).mockReturnValue({
      data: status === AUTH_SESSION_STATUS.AUTHENTICATED ? { requiresPasswordChange: false } : null,
      isLoading: false,
    } as ReturnType<typeof useCurrentUser>);
    const App = createRemixStub([
      {
        path: "/courses",
        Component: () => (
          <MFAGuard mode="app">
            <div>Protected content</div>
          </MFAGuard>
        ),
        ErrorBoundary: () => <div>Session check failed</div>,
      },
      { path: "/auth/mfa", Component: () => <div>MFA challenge</div> },
      { path: "/auth/login", Component: () => <div>Login</div> },
    ]);
    return renderWith({ withQuery: true }).render(<App initialEntries={["/courses"]} />);
  }

  it("ignores a forged localStorage verification flag", async () => {
    localStorage.setItem(
      "current-user-storage",
      JSON.stringify({ state: { hasVerifiedMFA: true } }),
    );
    renderSession(AUTH_SESSION_STATUS.MFA_REQUIRED);
    expect(await screen.findByText("MFA challenge")).toBeTruthy();
    expect(screen.queryByText("Protected content")).toBeNull();
  });

  it("allows a server-authenticated session without a browser verification flag", async () => {
    renderSession(AUTH_SESSION_STATUS.AUTHENTICATED);
    expect(await screen.findByText("Protected content")).toBeTruthy();
  });

  it("returns an expired session to login", async () => {
    renderSession(null);
    expect(await screen.findByText("Login")).toBeTruthy();
  });

  it("shows the route error state when the first session check fails", async () => {
    renderSession(undefined, new Error("Network Error"));
    expect(await screen.findByText("Session check failed")).toBeTruthy();
  });

  it("keeps the page usable when a background session refetch fails", async () => {
    renderSession(AUTH_SESSION_STATUS.AUTHENTICATED, new Error("Network Error"));
    expect(await screen.findByText("Protected content")).toBeTruthy();
  });
});
