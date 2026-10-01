import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { Dashboard } from "./Dashboard";

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: {} }),
}));
vi.mock("~/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));
vi.mock("~/components/PlatformLogo", () => ({
  PlatformLogo: ({ variant, className }: { variant: string; className: string }) => (
    <span data-testid={`logo-${variant}`} className={className} />
  ),
}));

describe("public dashboard header", () => {
  it("shows the signet on mobile and the full logo on desktop", async () => {
    const RemixStub = createRemixStub([
      { path: "/", Component: () => <Dashboard isAuthenticated={false} /> },
    ]);

    renderWith().render(<RemixStub />);

    const signet = await screen.findByTestId("logo-signet");
    const full = screen.getByTestId("logo-full");

    expect(signet).toHaveClass("md:hidden");
    expect(full).toHaveClass("hidden", "md:block");
    expect(signet.closest("a")).toHaveAttribute("href", "/courses");
  });
});
