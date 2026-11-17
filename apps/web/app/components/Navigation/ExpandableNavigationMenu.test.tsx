import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "~/components/ui/tooltip";
import { renderWith } from "~/utils/testUtils";

import { ExpandableNavigationMenu } from "./ExpandableNavigationMenu";

vi.mock("~/components/Icon", () => ({ Icon: () => null }));

describe("ExpandableNavigationMenu keyboard order", () => {
  it("gives the group trigger a single Tab stop", async () => {
    const user = userEvent.setup();
    const RemixStub = createRemixStub([
      {
        path: "/",
        Component: () => (
          <TooltipProvider>
            <ExpandableNavigationMenu
              items={[{ label: "Courses", link: "/courses", iconName: "Info" }]}
              setIsMobileNavOpen={vi.fn()}
              expandableLabel="Manage"
              expandableIcon="Info"
              isExpandable
              showNavigationLabels
              shouldShowTooltips={false}
              isSidebarCollapsed={false}
            />
          </TooltipProvider>
        ),
      },
    ]);

    renderWith().render(<RemixStub />);

    await user.tab();

    expect(await screen.findByRole("button", { name: "Manage" })).toHaveFocus();

    await user.tab();

    expect(document.body).toHaveFocus();
  });
});
