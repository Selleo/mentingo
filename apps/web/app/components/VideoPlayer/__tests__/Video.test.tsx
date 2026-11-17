import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { Video } from "../Video";

const THUMBNAIL_URL = "https://vz-example.b-cdn.net/video-id/thumbnail.jpg?token=secret";

vi.mock("~/api/queries/useThumbnail", () => ({
  useThumbnail: () => ({ data: { url: THUMBNAIL_URL } }),
}));

const { videoPlayerMock } = vi.hoisted(() => ({
  videoPlayerMock: vi.fn((_props: Record<string, unknown>) => <div data-testid="video-player" />),
}));

vi.mock("../VideoPlayer", () => ({
  VideoPlayer: videoPlayerMock,
}));

const VIDEO_SRC = "https://example.com/video.mp4";

describe("Video", () => {
  it("names the play button after the video title instead of the thumbnail URL", () => {
    renderWith().render(<Video src={VIDEO_SRC} title="Intro to budgeting" />);

    const playButton = screen.getByRole("button", { name: "Play video: Intro to budgeting" });

    expect(playButton.tagName).toBe("BUTTON");
    expect(screen.getByRole("presentation", { hidden: true })).toHaveAttribute("alt", "");
  });

  it("falls back to a generic name without a title", () => {
    renderWith().render(<Video src={VIDEO_SRC} />);

    expect(screen.getByRole("button", { name: "Play video" })).toBeInTheDocument();
  });

  it.each(["{Enter}", " "])("starts the player from the keyboard with %s", async (key) => {
    const user = userEvent.setup();

    renderWith().render(<Video src={VIDEO_SRC} title="Intro" />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Play video: Intro" })).toHaveFocus();

    await user.keyboard(key);

    expect(screen.getByTestId("video-player")).toBeInTheDocument();
    expect(videoPlayerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoPlay: true, focusOnMount: true }),
      expect.anything(),
    );
  });

  it("disables the play button when there is no video source", () => {
    renderWith().render(<Video title="Intro" />);

    expect(screen.getByRole("button", { name: "Play video: Intro" })).toBeDisabled();
  });
});
