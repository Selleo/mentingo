import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
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
});
