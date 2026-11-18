import { createRemixStub } from "@remix-run/testing";
import { fireEvent, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { NavigationHeader } from "./NavigationHeader";

vi.mock("../PlatformLogo", () => ({
  PlatformLogo: ({ variant, className }: { variant: string; className: string }) => (
    <span data-testid={`logo-${variant}`} className={className} />
  ),
}));
vi.mock("./NavigationGlobalSearchWrapper", () => ({
  NavigationGlobalSearchWrapper: () => null,
}));

describe("navigation header", () => {
  it("shows the signet on mobile and the full logo in the expanded desktop sidebar", async () => {
    const RemixStub = createRemixStub([
      {
        path: "/",
        Component: () => (
          <NavigationHeader
            isMobileNavOpen={false}
            setIsMobileNavOpen={vi.fn()}
            is2xlBreakpoint={false}
            isSidebarCollapsed={false}
          />
        ),
      },
    ]);

    renderWith().render(<RemixStub />);

    const signet = await screen.findByTestId("logo-signet");
    const full = screen.getByTestId("logo-full");

    expect(signet).toHaveClass("2xl:hidden");
    expect(full).toHaveClass("hidden", "2xl:block");
  });

  it("hands the Menu button to the ref and exposes whether the menu is open", async () => {
    const menuToggleRef = createRef<HTMLButtonElement>();
    const Header = () => {
      const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

      return (
        <NavigationHeader
          isMobileNavOpen={isMobileNavOpen}
          setIsMobileNavOpen={setIsMobileNavOpen}
          is2xlBreakpoint={false}
          isSidebarCollapsed={false}
          menuToggleRef={menuToggleRef}
        />
      );
    };
    const RemixStub = createRemixStub([{ path: "/", Component: Header }]);

    renderWith().render(<RemixStub />);

    const menuButton = await screen.findByRole("button", { name: "Menu" });

    expect(menuToggleRef.current).toBe(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);

    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true");
  });
});
