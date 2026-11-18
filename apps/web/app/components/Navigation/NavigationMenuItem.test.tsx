import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";
import { renderWith } from "~/utils/testUtils";

import { NavigationMenuItem } from "./NavigationMenuItem";

import type { LeafMenuItem } from "~/config/navigationConfig";

vi.mock("~/components/Icon", () => ({ Icon: () => null }));

const item: LeafMenuItem = { label: "Courses", link: "/courses", iconName: "Info" };

const renderInRouter = (element: JSX.Element) => {
  const RemixStub = createRemixStub([
    { path: "/", Component: () => <TooltipProvider>{element}</TooltipProvider> },
  ]);

  return renderWith().render(<RemixStub />);
};

describe("navigation items keyboard order", () => {
  it("gives a menu item a single Tab stop", async () => {
    const user = userEvent.setup();

    renderInRouter(
      <menu>
        <NavigationMenuItem item={item} setIsMobileNavOpen={vi.fn()} />
      </menu>,
    );

    await user.tab();
    expect(await screen.findByRole("link", { name: "Courses" })).toHaveFocus();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    await user.tab();
    expect(document.body).toHaveFocus();
  });
});
