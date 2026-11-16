import { AUTH_SESSION_STATUS, PERMISSIONS } from "@repo/shared";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import {
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MFAGuard } from "~/Guards/MFAGuard";
import { RequireAuthenticatedUser } from "~/Guards/RequireAuthenticatedUser";
import { RouteGuard } from "~/Guards/RouteGuard";
import { useNavigationTracker } from "~/hooks/useNavigationTracker";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";
import { useSyncUserAfterLogin } from "~/modules/Dashboard/hooks/useSyncUserAfterLogin";

import IndexRedirectPage from "./IndexRedirect.page";
import UserDashboardLayout from "./UserDashboard.layout";

import type { CurrentUserResponse } from "~/api/generated-api";

type AuthSession = { status: string; setupRequired?: boolean } | null;

const mocks = vi.hoisted(() => ({
  user: null as CurrentUserResponse["data"] | null,
  session: null as AuthSession,
}));
vi.mock("~/modules/Dashboard/hooks/useSyncUserAfterLogin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./hooks/useSyncUserAfterLogin")>();
  return { useSyncUserAfterLogin: vi.fn(actual.useSyncUserAfterLogin) };
});
vi.mock("~/api/queries/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: mocks.user, isLoading: false }),
  useCurrentUserSuspense: () => ({ data: mocks.user }),
}));
vi.mock("~/api/queries/useAuthSession", () => ({
  useAuthSession: () => ({ data: mocks.session, isLoading: false, isError: false }),
}));
vi.mock("~/api/queries/useCurrentUserSessionSuspense", () => ({
  useCurrentUserSessionSuspense: () => ({ data: mocks.user }),
}));
vi.mock("~/api/queries", () => ({ useCurrentUserSuspense: () => ({ data: mocks.user }) }));
vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettingsSuspense: () => ({ data: {} }),
}));
vi.mock("~/modules/Dashboard/Dashboard", () => ({ Dashboard: () => <Outlet /> }));

function Trace({ paths }: { paths: string[] }) {
  useNavigationTracker();
  const { pathname, search } = useLocation();
  const path = `${pathname}${search}`;
  if (paths.at(-1) !== path) paths.push(path);
  // Bound a regression so an accidental infinite loop fails instead of hanging.
  if (paths.length >= 8) return <div>Redirect loop detected</div>;
  return <Outlet />;
}

function SettingsDestination() {
  const navigate = useNavigate();
  return (
    <div>
      Settings destination
      <button onClick={() => navigate("/settings?tab=security")}>Security tab</button>
    </div>
  );
}

function router(paths: string[], initialEntry = "/") {
  return (
    <StrictMode>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<Trace paths={paths} />}>
            <Route element={<UserDashboardLayout />}>
              <Route index element={<IndexRedirectPage />} />
              <Route path="dashboard" element={<div>Dashboard destination</div>} />
              <Route path="settings" element={<SettingsDestination />} />
            </Route>
            <Route
              path="admin/users"
              element={
                <RequireAuthenticatedUser>
                  <RouteGuard>
                    <div>Protected users</div>
                  </RouteGuard>
                </RequireAuthenticatedUser>
              }
            />
            <Route path="development-paths" element={<Navigate to="/dashboard" replace />} />
            <Route path="course/:id" element={<div>Course destination</div>} />
            <Route
              path="auth/login"
              element={
                <MFAGuard mode="auth">
                  <div>Login destination</div>
                </MFAGuard>
              }
            />
            <Route path="auth/mfa" element={<div>MFA destination</div>} />
            <Route path="auth/change-password" element={<div>Password destination</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );
}

function save(pathname: string) {
  useNavigationHistoryStore
    .getState()
    .addLastUnauthorizedEntry({ pathname, timestamp: Date.now() });
}

describe("post-auth navigation", () => {
  beforeEach(() => {
    mocks.user = {
      permissions: [PERMISSIONS.DASHBOARD_READ],
      shouldVerifyMFA: false,
      requiresPasswordChange: false,
    } as CurrentUserResponse["data"];
    mocks.session = { status: AUTH_SESSION_STATUS.AUTHENTICATED };
    sessionStorage.clear();
    useNavigationHistoryStore.getState().clearHistory();
    useCurrentUserStore.setState({ currentUser: mocks.user });
  });

  it("has one session synchronization owner for the protected dashboard", () => {
    vi.mocked(useSyncUserAfterLogin).mockClear();
    const view = render(router([], "/dashboard"));
    expect(view.getByText("Dashboard destination")).toBeInTheDocument();
    // StrictMode renders each owner twice; there must be no nested owner.
    expect(useSyncUserAfterLogin).toHaveBeenCalledTimes(2);
    expect(useSyncUserAfterLogin).toHaveBeenCalledWith(mocks.user);
  });

  it("settles on the dashboard when the saved destination is /", async () => {
    save("/");
    const paths: string[] = [];
    const view = render(router(paths));
    await waitFor(() => expect(view.getByText("Dashboard destination")).toBeInTheDocument());
    expect(paths).toEqual(["/", "/dashboard"]);
    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
  });

  it("consumes a saved dashboard destination on arrival", async () => {
    save("/dashboard");
    const paths: string[] = [];
    const view = render(router(paths, "/dashboard"));
    await waitFor(() => expect(view.getByText("Dashboard destination")).toBeInTheDocument());
    expect(paths).toEqual(["/dashboard"]);
    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
  });

  it("does not retry a destination rejected by the real permission guard", async () => {
    save("/admin/users");
    const paths: string[] = [];
    const view = render(router(paths));
    await waitFor(() => expect(view.getByText("Dashboard destination")).toBeInTheDocument());
    expect(paths).toEqual(["/", "/admin/users", "/", "/dashboard"]);
    expect(view.queryByText("Protected users")).not.toBeInTheDocument();
    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
  });

  it("does not retry a feature destination that redirects to dashboard", async () => {
    save("/development-paths");
    const paths: string[] = [];
    const view = render(router(paths));
    await waitFor(() => expect(view.getByText("Dashboard destination")).toBeInTheDocument());
    expect(paths).toEqual(["/", "/development-paths", "/dashboard"]);
  });

  it("treats pathname and search together when consuming history", async () => {
    save("/settings?tab=profile");
    const paths: string[] = [];
    const view = render(router(paths, "/settings?tab=profile"));
    await waitFor(() => expect(view.getByText("Settings destination")).toBeInTheDocument());
    expect(paths).toEqual(["/settings?tab=profile"]);
    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
  });

  it("returns to the saved query string when arriving at a different tab", async () => {
    save("/settings?tab=profile");
    const paths: string[] = [];
    const view = render(router(paths, "/settings?tab=security"));
    await waitFor(() => expect(view.getByText("Settings destination")).toBeInTheDocument());
    expect(paths).toEqual(["/settings?tab=security", "/settings?tab=profile"]);
    fireEvent.click(view.getByRole("button", { name: "Security tab" }));
    await waitFor(() => expect(view.getByText("Settings destination")).toBeInTheDocument());
    expect(paths).toEqual([
      "/settings?tab=security",
      "/settings?tab=profile",
      "/settings?tab=security",
    ]);
  });

  it("preserves a course destination through an OAuth landing at root", async () => {
    save("/course/intro?language=pl");
    const paths: string[] = [];
    const view = render(router(paths));
    await waitFor(() => expect(view.getByText("Course destination")).toBeInTheDocument());
    expect(paths).toEqual(["/", "/course/intro?language=pl"]);
    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
  });

  it("preserves pending history until MFA completes", async () => {
    const user = mocks.user;
    mocks.user = null;
    mocks.session = { status: AUTH_SESSION_STATUS.MFA_REQUIRED, setupRequired: false };
    useCurrentUserStore.setState({ currentUser: undefined });
    save("/course/intro?language=pl");
    const paths: string[] = [];
    const view = render(router(paths));
    await waitFor(() => expect(view.getByText("MFA destination")).toBeInTheDocument());
    expect(paths).not.toContain("/course/intro?language=pl");
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
      "/course/intro?language=pl",
    );
    view.unmount();

    mocks.user = user;
    mocks.session = { status: AUTH_SESSION_STATUS.AUTHENTICATED };
    act(() => useCurrentUserStore.setState({ currentUser: user ?? undefined }));
    const next = render(router([]));
    await waitFor(() => expect(next.getByText("Course destination")).toBeInTheDocument());
    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
  });

  it("preserves pending history until password change completes", async () => {
    Object.assign(mocks.user ?? {}, { requiresPasswordChange: true });
    save("/course/intro?language=pl");
    const paths: string[] = [];
    const view = render(router(paths));
    await waitFor(() => expect(view.getByText("Password destination")).toBeInTheDocument());
    expect(paths).not.toContain("/course/intro?language=pl");
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
      "/course/intro?language=pl",
    );
    view.unmount();

    Object.assign(mocks.user ?? {}, { requiresPasswordChange: false });
    const next = render(router([]));
    await waitFor(() => expect(next.getByText("Course destination")).toBeInTheDocument());
    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
  });

  it("records the full anonymous destination before showing login", async () => {
    mocks.user = null;
    useCurrentUserStore.setState({ currentUser: undefined });
    const paths: string[] = [];
    const view = render(router(paths, "/settings?tab=profile"));
    await waitFor(() => expect(view.getByText("Login destination")).toBeInTheDocument());
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
      "/settings?tab=profile",
    );
    expect(view.queryByText("Settings destination")).not.toBeInTheDocument();
  });

  it("preserves the return destination when persisted user data outlives the session", async () => {
    mocks.user = null;
    // Keep the previously persisted authenticated user in Zustand.
    const paths: string[] = [];
    const view = render(router(paths, "/settings?tab=profile"));
    await waitFor(() => expect(view.getByText("Login destination")).toBeInTheDocument());
    expect(useCurrentUserStore.getState().currentUser).toBeUndefined();
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
      "/settings?tab=profile",
    );
  });

  it("recovers a logged-out root visit after login without a redirect loop", async () => {
    const user = mocks.user;
    mocks.user = null;
    useCurrentUserStore.setState({ currentUser: undefined });
    const paths: string[] = [];
    const view = render(router(paths));
    await waitFor(() => expect(view.getByText("Login destination")).toBeInTheDocument());
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe("/");

    mocks.user = user;
    view.rerender(router(paths));
    await waitFor(() => expect(view.getByText("Dashboard destination")).toBeInTheDocument());
    expect(paths).toEqual(["/", "/auth/login", "/", "/dashboard"]);
    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
  });
});
