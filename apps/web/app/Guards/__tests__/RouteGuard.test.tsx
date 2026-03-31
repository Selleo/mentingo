import { createRemixStub } from "@remix-run/testing";
import { PERMISSIONS } from "@repo/shared";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCurrentUserSuspense } from "~/api/queries";
import { renderWith } from "~/utils/testUtils";

import { RouteGuard } from "../RouteGuard";

vi.mock("~/api/queries");

describe("RouteGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children when user has access", async () => {
    vi.mocked(useCurrentUserSuspense).mockReturnValue({
      data: {
        permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.COURSE_UPDATE],
      },
    } as ReturnType<typeof useCurrentUserSuspense>);

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
    vi.mocked(useCurrentUserSuspense).mockReturnValue({
      data: {
        permissions: [PERMISSIONS.COURSE_READ],
      },
    } as ReturnType<typeof useCurrentUserSuspense>);

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
