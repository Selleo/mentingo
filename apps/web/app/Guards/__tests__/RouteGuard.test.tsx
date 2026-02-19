import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUserRole } from "~/hooks/useUserRole";
import { renderWith } from "~/utils/testUtils";

import { RouteGuard } from "../RouteGuard";

vi.mock("~/hooks/useUserRole");

describe("RouteGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children when user has access", async () => {
    vi.mocked(useUserRole).mockReturnValue({
      role: "admin",
      isAdmin: true,
      isContentCreator: false,
      isAdminLike: true,
      isStudent: false,
      isManagingTenantAdmin: false,
    });

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
    vi.mocked(useUserRole).mockReturnValue({
      role: "student",
      isAdmin: false,
      isContentCreator: false,
      isAdminLike: false,
      isStudent: false,
      isManagingTenantAdmin: false,
    });

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
