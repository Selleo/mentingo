import { render } from "@testing-library/react";
import videojs from "video.js";

import { HeroTrailerVideo } from "./HeroTrailerVideo";

vi.mock("video.js", () => ({ default: vi.fn() }));

describe("HeroTrailerVideo", () => {
  const lowRendition = { height: 360, enabled: vi.fn() };
  const highRendition = { height: 2160, enabled: vi.fn() };
  const player = {
    ready: vi.fn((callback: () => void) => callback()),
    muted: vi.fn(),
    loop: vi.fn(),
    src: vi.fn(),
    load: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    off: vi.fn(),
    tech: vi.fn(() => ({
      vhs: { representations: () => [lowRendition, highRendition] },
    })),
    isDisposed: vi.fn(() => false),
    dispose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(videojs).mockReturnValue(player as unknown as ReturnType<typeof videojs>);
  });

  it("starts HLS with the highest bitrate regardless of hero size or network hint", () => {
    render(<HeroTrailerVideo src="https://example.com/trailer/playlist.m3u8" />);

    expect(videojs).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        html5: expect.objectContaining({
          vhs: expect.objectContaining({
            bandwidth: Number.MAX_SAFE_INTEGER,
            limitRenditionByPlayerDimensions: false,
            useNetworkInformationApi: false,
            overrideNative: true,
          }),
        }),
      }),
    );
    expect(player.src).toHaveBeenCalledWith([
      {
        src: "https://example.com/trailer/playlist.m3u8",
        type: "application/vnd.apple.mpegurl",
      },
    ]);
  });

  it("keeps all renditions available for adaptive playback after playlist events", () => {
    render(<HeroTrailerVideo src="https://example.com/trailer/playlist.m3u8" />);

    for (const [event, callback] of player.on.mock.calls) {
      if (event === "loadedmetadata" || event === "loadedplaylist") {
        (callback as () => void)();
      }
    }

    expect(lowRendition.enabled).not.toHaveBeenCalledWith(false);
    expect(highRendition.enabled).not.toHaveBeenCalledWith(false);
  });

  it("preserves MP4 playback and disposes the old player when the source changes", () => {
    const { rerender, unmount } = render(<HeroTrailerVideo src="https://example.com/first.mp4" />);
    expect(player.src).toHaveBeenLastCalledWith([
      { src: "https://example.com/first.mp4", type: "video/mp4" },
    ]);

    rerender(<HeroTrailerVideo src="https://example.com/second.m3u8?token=example" />);
    expect(player.dispose).toHaveBeenCalledTimes(1);
    expect(player.src).toHaveBeenLastCalledWith([
      {
        src: "https://example.com/second.m3u8?token=example",
        type: "application/vnd.apple.mpegurl",
      },
    ]);
    unmount();
    expect(player.dispose).toHaveBeenCalledTimes(2);
  });
});
