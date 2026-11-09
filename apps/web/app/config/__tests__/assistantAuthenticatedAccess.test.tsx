import { createRemixStub } from "@remix-run/testing";
import { PERMISSIONS } from "@repo/shared";
import { screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RouteGuard } from "~/Guards/RouteGuard";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";
import UserDashboardLayout from "~/modules/Dashboard/UserDashboard.layout";
import { renderWith } from "~/utils/testUtils";

import type { PermissionKey } from "@repo/shared";
import type { CurrentUserResponse } from "~/api/generated-api";

const session = vi.hoisted(() => ({ user: null as CurrentUserResponse["data"] | null }));
vi.mock("~/api/queries", () => ({ useCurrentUserSuspense: () => ({ data: session.user }) }));
vi.mock("~/api/queries/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: session.user, isLoading: false }),
  useCurrentUserSuspense: () => ({ data: session.user }),
}));
vi.mock("~/api/queries/useAuthSession", async () => {
  const { AUTH_SESSION_STATUS } = await import("@repo/shared");
  return {
    useAuthSession: () => ({
      data: session.user && {
        status: session.user.shouldVerifyMFA
          ? AUTH_SESSION_STATUS.MFA_REQUIRED
          : AUTH_SESSION_STATUS.AUTHENTICATED,
      },
      isLoading: false,
      isError: false,
    }),
  };
});
vi.mock("~/api/queries/useCurrentUserSessionSuspense", () => ({
  useCurrentUserSessionSuspense: () => ({ data: session.user }),
}));
vi.mock("~/modules/Gamification/GamificationRewardToasts", () => ({
  GamificationRewardToasts: () => null,
}));
vi.mock("~/modules/Dashboard/Dashboard", () => ({
  Dashboard: () => (
    <RouteGuard>
      <Outlet />
    </RouteGuard>
  ),
}));

function renderAssistant(path: string) {
  const Router = createRemixStub([
    {
      Component: UserDashboardLayout,
      children: [
        { path: "/assistant/:threadId?", Component: () => <div>Assistant workspace</div> },
      ],
    },
    { path: "/auth/login", Component: () => <div>Sign in required</div> },
    { path: "/auth/mfa", Component: () => <div>MFA required</div> },
    { path: "/auth/change-password", Component: () => <div>Password update required</div> },
  ]);
  return renderWith().render(<Router initialEntries={[path]} />);
}

beforeEach(() => {
  session.user = null;
  useNavigationHistoryStore.getState().clearHistory();
  useCurrentUserStore.setState({ currentUser: undefined });
});

describe("Assistant authenticated route access", () => {
  it.each(["/assistant", "/assistant/saved-thread"])(
    "redirects anonymous visitors from %s before mounting the workspace",
    async (path) => {
      renderAssistant(path);
      expect(await screen.findByText("Sign in required")).toBeInTheDocument();
      expect(screen.queryByText("Assistant workspace")).not.toBeInTheDocument();
    },
  );

  it.each<{ name: string; permissions: PermissionKey[] }>([
    { name: "custom role without permissions", permissions: [] },
    { name: "learner", permissions: [PERMISSIONS.COURSE_READ] },
    { name: "administrator", permissions: [PERMISSIONS.AI_THREAD_READ] },
  ])("allows an authenticated $name to open their Assistant", async ({ permissions }) => {
    session.user = {
      permissions,
      roleSlugs: ["custom"],
      shouldVerifyMFA: false,
      requiresPasswordChange: false,
    } as CurrentUserResponse["data"];
    renderAssistant("/assistant/saved-thread");
    expect(await screen.findByText("Assistant workspace")).toBeInTheDocument();
  });

  it.each([
    { shouldVerifyMFA: true, requiresPasswordChange: false, destination: "MFA required" },
    {
      shouldVerifyMFA: false,
      requiresPasswordChange: true,
      destination: "Password update required",
    },
  ])(
    "preserves the authenticated account setup gate: $destination",
    async ({ destination, ...requirements }) => {
      session.user = { permissions: [], ...requirements } as unknown as CurrentUserResponse["data"];
      renderAssistant("/assistant");
      expect(await screen.findByText(destination)).toBeInTheDocument();
      expect(screen.queryByText("Assistant workspace")).not.toBeInTheDocument();
    },
  );
});
