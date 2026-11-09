import { createRemixStub } from "@remix-run/testing";
import { PERMISSIONS } from "@repo/shared";
import { screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { RouteGuard } from "./RouteGuard";

const state = vi.hoisted(() => ({
  settings: undefined as { gamificationEnabled: boolean } | undefined,
  isPending: false,
  permissions: [] as string[],
}));
vi.mock("~/api/queries/useCurrentUserSessionSuspense", () => ({
  useCurrentUserSessionSuspense: () => ({ data: { permissions: state.permissions } }),
}));
vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: state.settings, isPending: state.isPending }),
}));

const mounted = vi.fn();
function renderRoute(path: string) {
  const Router = createRemixStub([
    {
      Component: () => (
        <RouteGuard>
          <Outlet />
        </RouteGuard>
      ),
      children: [
        {
          path: "/admin/gamification/*",
          Component: () => {
            mounted();
            return <div>Protected achievements</div>;
          },
        },
        {
          path: "/leaderboards",
          Component: () => {
            mounted();
            return <div>Protected achievements</div>;
          },
        },
        { path: "/settings", Component: () => <div>Platform settings</div> },
      ],
    },
    { path: "/", Component: () => <div>Safe destination</div> },
  ]);
  return renderWith().render(<Router initialEntries={[path]} />);
}

beforeEach(() => {
  state.settings = { gamificationEnabled: false };
  state.isPending = false;
  state.permissions = [PERMISSIONS.GAMIFICATION_MANAGE, PERMISSIONS.GAMIFICATION_LEADERBOARD_READ];
  mounted.mockClear();
});

describe("gamification route access", () => {
  it.each([
    "/admin/gamification",
    "/admin/gamification/achievements/new",
    "/admin/gamification/achievements/saved-id",
    "/ADMIN/GAMIFICATION/",
    "/leaderboards",
  ])("blocks disabled direct entry to %s without mounting child queries", async (path) => {
    renderRoute(path);
    expect(await screen.findByText("Safe destination")).toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalled();
  });
  it("does not mount the page while settings are loading", () => {
    state.settings = undefined;
    state.isPending = true;
    renderRoute("/admin/gamification");
    expect(mounted).not.toHaveBeenCalled();
    expect(screen.queryByText("Safe destination")).not.toBeInTheDocument();
  });
  it("fails closed when settings are unavailable", async () => {
    state.settings = undefined;
    renderRoute("/admin/gamification");
    expect(await screen.findByText("Safe destination")).toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalled();
  });
  it("allows enabled gamification", async () => {
    state.settings = { gamificationEnabled: true };
    renderRoute("/admin/gamification/achievements/new");
    expect(await screen.findByText("Protected achievements")).toBeInTheDocument();
  });
  it("preserves permission checks when enabled", async () => {
    state.settings = { gamificationEnabled: true };
    state.permissions = [];
    renderRoute("/admin/gamification");
    expect(await screen.findByText("Safe destination")).toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalled();
  });
  it("keeps settings accessible so gamification can be enabled again", async () => {
    renderRoute("/settings");
    expect(await screen.findByText("Platform settings")).toBeInTheDocument();
  });
});
