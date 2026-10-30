import { act, render } from "@testing-library/react";
import videojs from "video.js";

import { HeroTrailerVideo } from "./HeroTrailerVideo";

vi.mock("video.js", () => ({ default: vi.fn() }));

describe("HeroTrailerVideo", () => {
  const playlists: { attributes: { RESOLUTION?: { height?: number } }; excludeUntil?: number }[] = [
    360, 720, 1080, 2160,
  ].map((height) => ({
    attributes: { RESOLUTION: { height } },
  }));
  const vhs = { playlists: { main: { playlists } }, selectPlaylist: vi.fn() };
  const player = {
    ready: vi.fn((callback: () => void) => callback()),
    muted: vi.fn(),
    loop: vi.fn(),
    src: vi.fn(),
    load: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    off: vi.fn(),
    tech: vi.fn(() => ({ vhs })),
    readyState: vi.fn(() => 2),
    isDisposed: vi.fn(() => false),
    dispose: vi.fn(),
  };
  const emit = (event: string) =>
    act(() => {
      for (const [name, callback] of player.on.mock.calls) {
        if (name === event) (callback as () => void)();
      }
    });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    for (const playlist of playlists) delete (playlist as { excludeUntil?: number }).excludeUntil;
    player.src.mockImplementation(() => {
      for (const [event, callback] of player.on.mock.calls) {
        if (event === "xhr-hooks-ready") (callback as () => void)();
      }
    });
    vhs.playlists.main.playlists = playlists;
    vi.mocked(videojs).mockReturnValue(player as unknown as ReturnType<typeof videojs>);
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the thumbnail and cancels downloads if startup takes four seconds", () => {
    const { container } = render(<HeroTrailerVideo src="https://example.com/playlist.m3u8" />);
    emit("loadeddata");
    expect(container.firstChild).toHaveClass("opacity-0");
    act(() => vi.advanceTimersByTime(4000));
    expect(player.dispose).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toHaveClass("opacity-0");
  });

  it("restores the thumbnail and stops the player after two seconds of interrupted playback", () => {
    const { container } = render(<HeroTrailerVideo src="https://example.com/playlist.m3u8" />);
    vhs.selectPlaylist();
    emit("playing");
    expect(container.firstChild).toHaveClass("opacity-100");
    emit("waiting");
    act(() => vi.advanceTimersByTime(2000));
    expect(player.dispose).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toHaveClass("opacity-0");
  });

  it("stops instead of switching quality when the fixed rendition fails", async () => {
    render(<HeroTrailerVideo src="https://example.com/playlist.m3u8" />);
    expect(vhs.selectPlaylist()).toBe(playlists[2]);
    Object.assign(playlists[2], { excludeUntil: Infinity });
    expect(vhs.selectPlaylist()).toBeUndefined();
    await act(async () => {
      await Promise.resolve();
    });
    expect(player.dispose).toHaveBeenCalledTimes(1);
    delete (playlists[2] as { excludeUntil?: number }).excludeUntil;
  });

  it("does not reveal HLS without a verified 1080p or 720p selection", () => {
    const { container } = render(<HeroTrailerVideo src="https://example.com/direct.m3u8" />);
    emit("playing");
    expect(container.firstChild).toHaveClass("opacity-0");
    expect(player.dispose).toHaveBeenCalledTimes(1);
  });

  it("falls back to fixed 720p only when 1080p is absent", () => {
    vhs.playlists.main.playlists = [playlists[0], playlists[1], playlists[3]];
    render(<HeroTrailerVideo src="https://example.com/playlist.m3u8" />);
    expect(vhs.selectPlaylist()).toBe(playlists[1]);
  });

  it("shows only the thumbnail when neither required rendition is advertised", async () => {
    vhs.playlists.main.playlists = [playlists[0], playlists[3], { attributes: {} }];
    const { container } = render(<HeroTrailerVideo src="https://example.com/playlist.m3u8" />);
    expect(vhs.selectPlaylist()).toBeUndefined();
    expect(vhs.playlists.main.playlists[0]).toBeUndefined();
    await act(async () => {
      await Promise.resolve();
    });
    expect(player.dispose).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toHaveClass("opacity-0");
  });

  it("cancels startup and stall deadlines when playback resumes", () => {
    render(<HeroTrailerVideo src="https://example.com/playlist.m3u8" />);
    vhs.selectPlaylist();
    emit("playing");
    emit("waiting");
    act(() => vi.advanceTimersByTime(1500));
    emit("playing");
    act(() => vi.advanceTimersByTime(10000));
    expect(player.dispose).not.toHaveBeenCalled();
  });

  it("does not mistake a stalled download with buffered playback for an interruption", () => {
    player.readyState.mockReturnValueOnce(4);
    render(<HeroTrailerVideo src="https://example.com/playlist.m3u8" />);
    vhs.selectPlaylist();
    emit("playing");
    emit("stalled");
    act(() => vi.advanceTimersByTime(5000));
    expect(player.dispose).not.toHaveBeenCalled();
  });

  it("stops on playback errors", () => {
    const { container } = render(<HeroTrailerVideo src="https://example.com/first.mp4" />);
    emit("playing");
    emit("error");
    expect(player.dispose).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toHaveClass("opacity-0");
  });

  it("preserves MP4 and resets visibility, listeners and timers on source change and unmount", () => {
    const { container, rerender, unmount } = render(
      <HeroTrailerVideo src="https://example.com/first.mp4" />,
    );
    expect(player.src).toHaveBeenLastCalledWith([
      { src: "https://example.com/first.mp4", type: "video/mp4" },
    ]);
    emit("playing");
    emit("waiting");
    rerender(<HeroTrailerVideo src="https://example.com/second.m3u8?token=signed" />);
    expect(player.dispose).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toHaveClass("opacity-0");
    expect(player.src).toHaveBeenLastCalledWith([
      {
        src: "https://example.com/second.m3u8?token=signed",
        type: "application/vnd.apple.mpegurl",
      },
    ]);
    unmount();
    expect(player.dispose).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(10000));
    expect(player.dispose).toHaveBeenCalledTimes(2);
    expect(player.off).toHaveBeenCalledWith("xhr-hooks-ready", expect.any(Function));
  });

  it("waits for VHS initialization after asynchronous source middleware", () => {
    player.src.mockImplementation(() => undefined);
    render(<HeroTrailerVideo src="https://example.com/playlist.m3u8" />);
    expect(player.tech).not.toHaveBeenCalled();
    emit("xhr-hooks-ready");
    expect(vhs.selectPlaylist()).toBe(playlists[2]);
  });

  it("selects only 1080p before the first variant request and never adapts down", () => {
    render(<HeroTrailerVideo src="https://example.com/playlist.m3u8?token=signed" />);
    expect(vhs.selectPlaylist()).toBe(playlists[2]);
    expect(vhs.selectPlaylist()).toBe(playlists[2]);
    expect(player.tech).toHaveBeenCalled();
  });
});
