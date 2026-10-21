import { PERMISSIONS } from "@repo/shared";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";

import { NAVIGATION_HANDLES } from "../../../e2e/data/navigation/handles";

import { NavigationFooter } from "./NavigationFooter";

const state = vi.hoisted(() => ({ canReadActivityLogs: true }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/api/mutations", () => ({ useLogoutUser: () => ({ mutate: vi.fn() }) }));
vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user", firstName: "Test", lastName: "Admin" } }),
}));
vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: ({ required }: { required: string[] }) => ({
    hasAccess: required.includes(PERMISSIONS.ACTIVITY_LOG_READ) && state.canReadActivityLogs,
  }),
}));
vi.mock("~/modules/Notifications/components", () => ({ NotificationsNavigationItem: () => null }));
vi.mock("../UserProfile/UserAvatar", () => ({ UserAvatar: () => null }));

const renderFooter = () =>
  render(
    <MemoryRouter initialEntries={["/admin/activity-logs"]}>
      <TooltipProvider>
        <NavigationFooter
          setIsMobileNavOpen={vi.fn()}
          showNavigationLabels
          shouldShowTooltips={false}
          isSidebarCollapsed={false}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe("Activity logs in the user navigation", () => {
  beforeEach(() => {
    state.canReadActivityLogs = true;
  });

  it("places activity logs immediately before settings in the user dropdown and closes on navigation", async () => {
    const user = userEvent.setup();
    renderFooter();
    await user.click(screen.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER));
    const links = within(screen.getByRole("menu")).getAllByRole("link");
    const index = links.findIndex((link) => link.textContent === "navigationSideBar.settings");
    expect(links[index - 1]).toHaveTextContent("navigationSideBar.activityLogs");
    expect(links[index - 1]).toHaveAttribute("href", "/admin/activity-logs");
    expect(links[index - 1]).toHaveAttribute("aria-current", "page");
    await user.click(links[index - 1]);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps activity logs available in the mobile footer", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "navigationSideBar.activityLogs" })).toHaveAttribute(
      "href",
      "/admin/activity-logs",
    );
  });

  it("hides activity logs in both footer variants without permission", async () => {
    state.canReadActivityLogs = false;
    renderFooter();
    expect(
      screen.queryByRole("link", { name: "navigationSideBar.activityLogs" }),
    ).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER));
    expect(
      screen.queryByRole("link", { name: "navigationSideBar.activityLogs" }),
    ).not.toBeInTheDocument();
  });
});
