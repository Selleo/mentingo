import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import ModernCourseCard from "./ModernCourseCard";

vi.mock("~/hooks/usePermissions", () => ({ usePermissions: () => ({ hasAccess: false }) }));

describe("ModernCourseCard picker variant", () => {
  it("keeps a playing trailer visible after the pointer leaves the card", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);

    const { container } = renderWith().render(
      <ModernCourseCard
        id="course-1"
        title="Leadership"
        category="Leadership"
        trailerUrl="https://example.test/trailer.mp4"
        variant="picker"
        mediaState="play"
        onSelect={vi.fn()}
      />,
    );
    const video = container.querySelector("video");
    if (!video) throw new Error("Expected a trailer video");

    fireEvent.playing(video);
    expect(video).toHaveClass("opacity-100");

    fireEvent.mouseLeave(screen.getByTestId("Leadership"));

    expect(video).toHaveClass("opacity-100");
  });
});
