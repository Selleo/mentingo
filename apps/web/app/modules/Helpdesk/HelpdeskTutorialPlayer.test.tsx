import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { helpdeskTutorialFixture } from "./__tests__/fixtures";
import { HelpdeskTutorialPlayer } from "./HelpdeskTutorialPlayer";

vi.mock("~/components/VideoPlayer/VideoPlayer", () => ({
  VideoPlayer: ({
    url,
    poster,
    provider,
    seekTo,
    seekRequestId,
  }: {
    url: string;
    poster: string;
    provider: string;
    seekTo: number;
    seekRequestId: number;
  }) => (
    <div
      data-testid="helpdesk-player"
      data-url={url}
      data-poster={poster}
      data-provider={provider}
      data-seek={seekTo}
      data-seek-request={seekRequestId}
    />
  ),
}));

describe("Helpdesk chapter playback", () => {
  it("keeps chapter-list seeking when the popup's extra timeline is hidden", () => {
    renderWith().render(
      <HelpdeskTutorialPlayer
        tutorial={helpdeskTutorialFixture}
        startMs={0}
        showChapterTimeline={false}
      />,
    );
    expect(screen.queryByLabelText("Video timeline")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Review publication 0:12/ }));
    expect(screen.getByTestId("helpdesk-player")).toHaveAttribute("data-seek", "12.345");
  });

  it("uses direct Bunny HLS and preserves millisecond search/chapter offsets", () => {
    renderWith().render(
      <HelpdeskTutorialPlayer tutorial={helpdeskTutorialFixture} startMs={12_345} />,
    );
    const player = screen.getByTestId("helpdesk-player");
    expect(player).toHaveAttribute("data-url", helpdeskTutorialFixture.videoUrl);
    expect(player).toHaveAttribute("data-poster", helpdeskTutorialFixture.posterUrl);
    expect(player).toHaveAttribute("data-provider", VIDEO_EMBED_PROVIDERS.BUNNY);
    expect(player).toHaveAttribute("data-seek", "12.345");
    fireEvent.click(screen.getByRole("button", { name: "0:00 Prepare the course" }));
    expect(player).toHaveAttribute("data-seek", "0");
    fireEvent.click(screen.getByRole("button", { name: "0:12 Review publication" }));
    expect(player).toHaveAttribute("data-seek", "12.345");
    expect(player).toHaveAttribute("data-seek-request", "2");
    expect(screen.queryByText(/sample footage/i)).not.toBeInTheDocument();
  });
});
