import { createRemixStub } from "@remix-run/testing";
import { PERMISSIONS } from "@repo/shared";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { renderWith } from "~/utils/testUtils";

import { RouteGuard } from "../RouteGuard";

vi.mock("~/api/queries/useCurrentUserSessionSuspense");

describe("RouteGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    useNavigationHistoryStore.getState().clearHistory();
  });

  it("redirects anonymous reports access without mounting child queries and remembers the URL", async () => {
    vi.mocked(useCurrentUserSessionSuspense).mockReturnValue({
      data: null,
    } as ReturnType<typeof useCurrentUserSessionSuspense>);
    const ProtectedQueries = vi.fn(() => <div>Protected queries</div>);
    const RemixStub = createRemixStub([
      {
        path: "/reports",
        Component: () => (
          <RouteGuard>
            <ProtectedQueries />
          </RouteGuard>
        ),
      },
      { path: "/auth/login", Component: () => <div>Login destination</div> },
    ]);
    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/reports?language=pl"]} />);
    expect(await screen.findByText("Login destination")).toBeTruthy();
    expect(ProtectedQueries).not.toHaveBeenCalled();
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
      "/reports?language=pl",
    );
  });

  it("allows anonymous public routes without mounting an authenticated-only query", async () => {
    vi.mocked(useCurrentUserSessionSuspense).mockReturnValue({
      data: null,
    } as ReturnType<typeof useCurrentUserSessionSuspense>);
    const RemixStub = createRemixStub([
      {
        path: "/courses",
        Component: () => (
          <RouteGuard>
            <div>Public courses</div>
          </RouteGuard>
        ),
      },
    ]);
    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/courses"]} />);
    expect(await screen.findByText("Public courses")).toBeTruthy();
  });

  it("should render children when user has access", async () => {
    vi.mocked(useCurrentUserSessionSuspense).mockReturnValue({
      data: {
        permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.COURSE_UPDATE],
      },
    } as ReturnType<typeof useCurrentUserSessionSuspense>);

    const RemixStub = createRemixStub([
      {
        path: "/",
        children: [
          {
            path: "admin/courses",
            Component: () => (
              <RouteGuard>
                <div>Protected Content</div>
              </RouteGuard>
            ),
          },
        ],
      },
    ]);

    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/admin/courses"]} />);

    expect(await screen.findByText("Protected Content")).toBeTruthy();
  });

  it("should not render when user has no access", async () => {
    vi.mocked(useCurrentUserSessionSuspense).mockReturnValue({
      data: {
        permissions: [PERMISSIONS.COURSE_READ],
      },
    } as ReturnType<typeof useCurrentUserSessionSuspense>);

    const RemixStub = createRemixStub([
      {
        path: "/",
        children: [
          {
            path: "admin/courses",
            Component: () => (
              <RouteGuard>
                <div>Protected Content</div>
              </RouteGuard>
            ),
          },
        ],
      },
    ]);

    renderWith({ withQuery: true }).render(<RemixStub initialEntries={["/admin/courses"]} />);

    expect(screen.queryByText("Protected Content")).toBeNull();
  });
});
