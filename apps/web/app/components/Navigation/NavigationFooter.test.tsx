import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
vi.mock("../UserProfile/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("~/components/Icon", () => ({ Icon: () => null }));
vi.mock("~/modules/SelfOnboarding/SelfOnboardingContent", () => ({
  default: () => <input aria-label="Help search" />,
}));

const renderFooter = () =>
  renderWith().render(
    <MemoryRouter>
      <NavigationFooter
        setIsMobileNavOpen={vi.fn()}
        showNavigationLabels
        shouldShowTooltips={false}
        isSidebarCollapsed={false}
      />
    </MemoryRouter>,
  );

describe("NavigationFooter profile dropdown", () => {
  it("opens help from the dropdown and restores profile focus after closing it", async () => {
    const user = userEvent.setup();
    renderFooter();
    const trigger = screen.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER);

    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "Help & tutorials" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await screen.findByRole("textbox", { name: "Help search" });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

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

  it("makes the profile links the menu items themselves, not links nested in a menu item", async () => {
    const user = userEvent.setup();

    renderFooter();
    await user.click(screen.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER));
    const menu = screen.getByRole("menu");

    expect(within(menu).queryAllByRole("link")).toHaveLength(0);
    expect(within(menu).getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile/user-1",
    );
    within(menu)
      .getAllByRole("menuitem")
      .forEach((menuItem) => {
        // No menu item or list between a menu item and its menu.
        expect(menuItem.parentElement?.closest("[role], menu, ul, ol")).toBe(menu);
      });
  });
});
