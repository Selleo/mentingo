import { fireEvent, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringSourceChip } from "./AuthoringSourceCitation";

const useLinkPreview = vi.fn();

vi.mock("~/api/queries/useCourseAuthoringLinkPreviewQuery", () => ({
  useCourseAuthoringLinkPreviewQuery: (url: string, enabled: boolean) =>
    useLinkPreview(url, enabled),
}));

describe("AuthoringSourceChip", () => {
  beforeEach(() => {
    useLinkPreview.mockReset();
    useLinkPreview.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("shows the favicon and domain and loads metadata only when opened", async () => {
    const user = userEvent.setup();
    useLinkPreview.mockImplementation((_url: string, enabled: boolean) => ({
      isLoading: false,
      data: enabled
        ? {
            url: "https://www.example.com/guide",
            finalUrl: "https://www.example.com/guide",
            domain: "example.com",
            title: "Onboarding guide",
            description: "Everything a new admin needs.",
            siteName: "Example Docs",
            imageUrl: null,
            faviconUrl: "https://www.example.com/icon.png",
          }
        : undefined,
    }));

    renderWith().render(
      <AuthoringSourceChip source={{ url: "https://www.example.com/guide", label: null }} />,
    );

    const chip = screen.getByTestId("authoring-source-chip");
    expect(chip).toHaveTextContent("example.com");
    expect(chip.querySelector("img")).toHaveAttribute("src", "https://www.example.com/favicon.ico");
    expect(useLinkPreview).toHaveBeenLastCalledWith("https://www.example.com/guide", false);

    await user.click(chip);

    expect(useLinkPreview).toHaveBeenLastCalledWith("https://www.example.com/guide", true);
    const popover = await screen.findByTestId("authoring-source-popover");
    expect(popover).toHaveTextContent("Onboarding guide");
    expect(popover).toHaveTextContent("Everything a new admin needs.");
    expect(popover).toHaveTextContent("Example Docs");
    expect(popover).toHaveTextContent("https://www.example.com/guide");
    const link = screen.getByRole("link", { name: /Open source/ });
    expect(link).toHaveAttribute("href", "https://www.example.com/guide");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to a globe icon when the favicon cannot load", () => {
    renderWith().render(
      <AuthoringSourceChip source={{ url: "https://example.org/a", label: "Example" }} />,
    );

    const chip = screen.getByTestId("authoring-source-chip");
    fireEvent.error(chip.querySelector("img") as HTMLImageElement);
    expect(screen.getByTestId("authoring-source-favicon-fallback")).toBeInTheDocument();
    expect(chip).toHaveAccessibleName("Source: Example (example.org)");
  });

  it("renders nothing for non-http URLs", () => {
    renderWith().render(
      <AuthoringSourceChip source={{ url: "javascript:alert(1)", label: null }} />,
    );

    expect(screen.queryByTestId("authoring-source-chip")).not.toBeInTheDocument();
  });
  it("keeps pointer events inside the popover so the drawer cannot close it", async () => {
    const user = userEvent.setup();
    const drawerPointerDown = vi.fn();

    renderWith().render(
      <div onPointerDown={drawerPointerDown}>
        <AuthoringSourceChip source={{ url: "https://www.example.com/guide", label: null }} />
      </div>,
    );

    await user.click(screen.getByTestId("authoring-source-chip"));
    drawerPointerDown.mockClear();
    fireEvent.pointerDown(await screen.findByRole("link", { name: /Open source/ }));

    expect(drawerPointerDown).not.toHaveBeenCalled();
    expect(screen.getByTestId("authoring-source-popover")).toHaveAttribute("data-vaul-no-drag");
  });
});
