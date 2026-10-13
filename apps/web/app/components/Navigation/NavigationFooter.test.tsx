import { fireEvent, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { NAVIGATION_HANDLES } from "../../../e2e/data/navigation/handles";

import { NavigationFooter } from "./NavigationFooter";

vi.mock("~/api/mutations", () => ({ useLogoutUser: () => ({ mutate: vi.fn() }) }));
vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user-1", firstName: "Ada", lastName: "Lovelace" } }),
}));
vi.mock("~/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAccess: false }) }));
vi.mock("./MobileNavigationFooterItems", () => ({ MobileNavigationFooterItems: () => null }));
vi.mock("./NavigationMenuItemLink", () => ({
  NavigationMenuItemLink: ({ item }: { item: { label: string; link: string } }) => (
    <a href={item.link}>{item.label}</a>
  ),
}));
vi.mock("../UserProfile/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("~/components/Icon", () => ({ Icon: () => null }));

const renderFooter = () =>
  renderWith().render(
    <NavigationFooter
      setIsMobileNavOpen={vi.fn()}
      showNavigationLabels
      shouldShowTooltips={false}
      isSidebarCollapsed={false}
    />,
  );

describe("NavigationFooter profile dropdown", () => {
  it("stays open after a complete pointer click and closes on Escape", async () => {
    const user = userEvent.setup();
    renderFooter();
    const trigger = screen.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER);
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
  });

  it("handles a click dispatched after the opening pointer event", async () => {
    renderFooter();
    const trigger = screen.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER);
    fireEvent(trigger, new MouseEvent("pointerdown", { bubbles: true, button: 0, ctrlKey: false }));
    fireEvent.pointerUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeVisible();
    fireEvent.keyDown(trigger, { key: "Escape" });
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
  });

  it("stays open when activated with the keyboard", async () => {
    const user = userEvent.setup();
    renderFooter();
    const trigger = screen.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER);
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeVisible();
    await user.keyboard("{Escape}");
  });
});
