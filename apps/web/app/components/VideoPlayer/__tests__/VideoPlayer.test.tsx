import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { VideoPlayer } from "../VideoPlayer";

type PlayerListener = () => void;

class FakeVideoJsPlayer {
  readonly element = document.createElement("div");

  private listeners = new Map<string, Set<PlayerListener>>();
  private videoTime = 20;
  private durationValue = 100;
  private volumeValue = 0.5;
  private mutedValue = false;
  private pausedValue = true;
  private fullscreenValue = false;
  private disposedValue = false;

  controls = vi.fn();
  removeClass = vi.fn();
  addClass = vi.fn();
  userActive = vi.fn();
  src = vi.fn();
  load = vi.fn();
  error = vi.fn(() => null);
  videoWidth = vi.fn(() => 1920);
  videoHeight = vi.fn(() => 1080);
  readyState = vi.fn(() => 1);
  el = vi.fn(() => this.element);
  dispose = vi.fn(() => {
    this.disposedValue = true;
  });

  ready(listener: PlayerListener) {
    listener();
  }

  on(eventName: string, listener: PlayerListener) {
    const listeners = this.listeners.get(eventName) ?? new Set();
    listeners.add(listener);
    this.listeners.set(eventName, listeners);

    return this;
  }

  off(eventName: string, listener: PlayerListener) {
    this.listeners.get(eventName)?.delete(listener);

    return this;
  }

  one(eventName: string, listener: PlayerListener) {
    const wrappedListener = () => {
      this.off(eventName, wrappedListener);
      listener();
    };

    return this.on(eventName, wrappedListener);
  }

  currentTime(value?: number) {
    if (value !== undefined) {
      this.videoTime = value;
    }

    return this.videoTime;
  }

  duration() {
    return this.durationValue;
  }

  volume(value?: number) {
    if (value !== undefined) {
      this.volumeValue = value;
    }

    return this.volumeValue;
  }

  muted(value?: boolean) {
    if (value !== undefined) {
      this.mutedValue = value;
    }

    return this.mutedValue;
  }

  paused() {
    return this.pausedValue;
  }

  play = vi.fn(() => {
    this.pausedValue = false;

    return Promise.resolve();
  });

  pause = vi.fn(() => {
    this.pausedValue = true;
  });

  isFullscreen(value?: boolean) {
    if (value !== undefined) {
      this.fullscreenValue = value;
    }

    return this.fullscreenValue;
  }

  requestFullscreen = vi.fn(() => {
    this.fullscreenValue = true;
  });

  exitFullscreen = vi.fn(() => {
    this.fullscreenValue = false;
  });

  isDisposed() {
    return this.disposedValue;
  }
}

const addHlsQualityControlComponent = vi.fn(() => document.createElement("div"));
let player: FakeVideoJsPlayer;

vi.mock("videojs-youtube", () => ({}));
vi.mock("../videojs-vimeo-tech", () => ({}));
vi.mock("../hlsQualityControlComponent", () => ({
  addHlsQualityControlComponent: () => addHlsQualityControlComponent(),
}));
vi.mock("video.js", () => ({
  default: vi.fn(() => player),
}));

const renderPlayer = async () => {
  const view = renderWith({ withQuery: true }).render(
    <VideoPlayer provider={VIDEO_EMBED_PROVIDERS.SELF} url="https://example.com/video.mp4" />,
  );
  await waitFor(() =>
    expect(view.container.querySelector("[data-vjs-player]")).toBeInTheDocument(),
  );

  return {
    ...view,
    playerContainer: view.container.querySelector("[data-vjs-player]") as HTMLElement,
  };
};

describe("VideoPlayer keyboard shortcuts", () => {
  beforeEach(() => {
    player = new FakeVideoJsPlayer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("toggles playback with space", async () => {
    const { playerContainer } = await renderPlayer();

    fireEvent.keyDown(playerContainer, { key: " " });
    expect(player.play).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(playerContainer, { key: " " });
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it("seeks backward and forward by five seconds", async () => {
    const { playerContainer } = await renderPlayer();

    fireEvent.keyDown(playerContainer, { key: "ArrowRight" });
    expect(player.currentTime()).toBe(25);

    fireEvent.keyDown(playerContainer, { key: "ArrowLeft" });
    expect(player.currentTime()).toBe(20);
  });

  it("clamps seek shortcuts to the video duration", async () => {
    const { playerContainer } = await renderPlayer();

    player.currentTime(98);
    fireEvent.keyDown(playerContainer, { key: "ArrowRight" });
    expect(player.currentTime()).toBe(100);

    player.currentTime(2);
    fireEvent.keyDown(playerContainer, { key: "ArrowLeft" });
    expect(player.currentTime()).toBe(0);
  });

  it("adjusts volume with arrow up and down", async () => {
    const { playerContainer } = await renderPlayer();

    fireEvent.keyDown(playerContainer, { key: "ArrowUp" });
    expect(player.volume()).toBeCloseTo(0.6);

    fireEvent.keyDown(playerContainer, { key: "ArrowDown" });
    expect(player.volume()).toBeCloseTo(0.5);
  });

  it("toggles mute, restarts, and toggles fullscreen", async () => {
    const { playerContainer } = await renderPlayer();

    fireEvent.keyDown(playerContainer, { key: "m" });
    expect(player.muted()).toBe(true);

    fireEvent.keyDown(playerContainer, { key: "0" });
    expect(player.currentTime()).toBe(0);

    fireEvent.keyDown(playerContainer, { key: "f" });
    expect(player.requestFullscreen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(playerContainer, { key: "f" });
    expect(player.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("keeps shortcuts working on the inner player element after fullscreen", async () => {
    await renderPlayer();

    fireEvent.keyDown(player.element, { key: " " });

    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("shows the bottom bar when keyboard events come from player controls", async () => {
    const { playerContainer } = await renderPlayer();
    const controlButton = document.createElement("button");
    controlButton.className = "vjs-control";
    controlButton.textContent = "Play";
    playerContainer.appendChild(controlButton);

    fireEvent.mouseLeave(playerContainer);
    expect(playerContainer).toHaveClass("mentingo-video-player--controls-hidden");

    fireEvent.keyDown(controlButton, { key: " " });
    expect(playerContainer).not.toHaveClass("mentingo-video-player--controls-hidden");
  });

  it("ignores shortcuts from interactive descendants", async () => {
    const { playerContainer } = await renderPlayer();
    const button = document.createElement("button");
    button.textContent = "Control";
    playerContainer.appendChild(button);

    fireEvent.keyDown(screen.getByRole("button", { name: "Control" }), { key: " " });

    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
  });
});
