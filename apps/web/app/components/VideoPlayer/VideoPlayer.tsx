"use client";

import {
  detectVideoProviderFromUrl,
  type VideoProvider,
  VIDEO_EMBED_PROVIDERS,
} from "@repo/shared";
import { useEffect, useMemo, useRef } from "react";
import { match } from "ts-pattern";
import videojs from "video.js";

import "video.js/dist/video-js.css";
import "videojs-youtube";
import { cn } from "~/lib/utils";

import {
  MENTINGO_FULLSCREEN_CONTROL_NAME,
  registerMentingoFullscreenControl,
} from "./VideoJSFullscreenControl";
import "./videojs-vimeo-tech";

import "./videoPlayer.css";

interface VideoPlayerProps {
  url: string;
  onEnded?: () => void;
  fill?: boolean;
  className?: string;
  provider: VideoProvider;
  getFullscreenTarget?: () => HTMLElement | null;
}

export type VideoJSType = ReturnType<typeof videojs>;
type VideoPlayerOptions = {
  autoplay: boolean;
  controls: boolean;
  inactivityTimeout: number;
  loop: boolean;
  bigPlayButton: boolean;
  responsive: boolean;
  fluid: boolean;
  fill: boolean;
  techOrder: string[];
  getFullscreenTarget?: () => HTMLElement | null;
};

type PlayerWithControlBar = VideoJSType & {
  controlBar?: {
    getChild: (name: string) => unknown;
    addChild: (name: string, options?: Record<string, unknown>) => unknown;
    removeChild: (child: unknown) => unknown;
  };
};
type PlayerWithErrorState = VideoJSType & {
  error: (err?: unknown) => unknown;
  removeClass?: (name: string) => void;
};
type VideoJsSource = {
  src: string;
  type?: string;
};

const replaceFullscreenControl = (player: VideoJSType) => {
  const playerWithControlBar = player as PlayerWithControlBar;
  const controlBar = playerWithControlBar.controlBar;
  if (!controlBar) return;

  const existingCustom = controlBar.getChild(MENTINGO_FULLSCREEN_CONTROL_NAME);
  if (!existingCustom) {
    controlBar.addChild(MENTINGO_FULLSCREEN_CONTROL_NAME, {});
  }

  const nativeFullscreen = controlBar.getChild("fullscreenToggle");
  if (nativeFullscreen) {
    controlBar.removeChild(nativeFullscreen);
  }
};

const getTypeByProvider = (provider: VideoProvider) =>
  match(provider)
    .with(VIDEO_EMBED_PROVIDERS.YOUTUBE, () => "video/youtube")
    .with(VIDEO_EMBED_PROVIDERS.VIMEO, () => "video/vimeo")
    .with(VIDEO_EMBED_PROVIDERS.BUNNY, () => "application/x-mpegURL")
    .with(VIDEO_EMBED_PROVIDERS.SELF, () => "video/mp4")
    .otherwise(() => "");

export const VideoPlayer = ({
  url,
  provider,
  onEnded,
  fill = true,
  className,
  getFullscreenTarget,
}: VideoPlayerProps) => {
  const resolvedProvider = useMemo(
    () => (provider === VIDEO_EMBED_PROVIDERS.UNKNOWN ? detectVideoProviderFromUrl(url) : provider),
    [provider, url],
  );
  const type = useMemo(() => getTypeByProvider(resolvedProvider), [resolvedProvider]);
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<VideoJSType | null>(null);
  const onEndedRef = useRef<(() => void) | undefined>(onEnded);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const options = useMemo<VideoPlayerOptions>(() => {
    return {
      autoplay: true,
      controls: true,
      inactivityTimeout: 3000,
      loop: false,
      bigPlayButton: false,
      responsive: true,
      fluid: false,
      fill: true,
      getFullscreenTarget,
      techOrder: ["html5", "youtube", "Vimeo"],
    };
  }, [getFullscreenTarget]);

  useEffect(() => {
    if (playerRef.current) return;
    registerMentingoFullscreenControl();

    const videoElement = document.createElement("video-js");
    videoElement.classList.add("mentingo-video-js");
    videoRef.current?.appendChild(videoElement);

    const player = (playerRef.current = videojs(videoElement, options));
    player.ready(() => {
      replaceFullscreenControl(player);
    });

    player.on("ended", () => {
      onEndedRef.current?.();
    });
  }, [options]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const playerWithErrorState = player as PlayerWithErrorState;
    playerWithErrorState.error(null);
    playerWithErrorState.removeClass?.("vjs-error");

    const typedSource: VideoJsSource[] = type ? [{ src: url, type }] : [{ src: url }];
    player.src(typedSource);

    let retriedWithoutType = false;
    const onError = () => {
      const mediaError = player.error();
      if (!mediaError || mediaError.code !== 4 || retriedWithoutType || !type) {
        return;
      }

      retriedWithoutType = true;
      playerWithErrorState.error(null);
      playerWithErrorState.removeClass?.("vjs-error");
      player.src([{ src: url }]);
    };

    player.on("error", onError);
    return () => {
      player.off("error", onError);
    };
  }, [url, type]);

  useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div
      data-vjs-player
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-black shadow-[0_8px_30px_rgba(18,21,33,0.28)]",
        fill ? "h-full" : "aspect-video",
        className,
      )}
    >
      <div ref={videoRef} className="size-full" />
    </div>
  );
};
