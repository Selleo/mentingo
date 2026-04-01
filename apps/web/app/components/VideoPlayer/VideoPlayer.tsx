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

type VideoJSType = ReturnType<typeof videojs>;

const replaceFullscreenControl = (player: VideoJSType) => {
  const controlBar = (
    player as VideoJSType & {
      controlBar?: {
        getChild: (name: string) => unknown;
        addChild: (name: string, options?: Record<string, unknown>) => unknown;
        removeChild: (child: unknown) => unknown;
      };
    }
  ).controlBar;

  if (!controlBar) return;

  if (!controlBar.getChild(MENTINGO_FULLSCREEN_CONTROL_NAME)) {
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
    .with(VIDEO_EMBED_PROVIDERS.BUNNY, () => "application/vnd.apple.mpegurl")
    .with(VIDEO_EMBED_PROVIDERS.SELF, () => "video/mp4")
    .otherwise(() => "");

const getSourceTypes = (url: string, type: string) => {
  const isInternalLessonResource = /\/api\/lesson\/lesson-resource\//i.test(url);

  return Array.from(
    new Set(
      isInternalLessonResource ? [type, "application/vnd.apple.mpegurl", "video/mp4"] : [type],
    ),
  ).filter(Boolean) as string[];
};

export const VideoPlayer = ({
  url,
  provider,
  onEnded,
  fill = true,
  className,
  getFullscreenTarget,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<VideoJSType | null>(null);
  const onEndedRef = useRef(onEnded);
  const lastSourceRef = useRef<string | null>(null);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const resolvedProvider = useMemo(
    () => (provider === VIDEO_EMBED_PROVIDERS.UNKNOWN ? detectVideoProviderFromUrl(url) : provider),
    [provider, url],
  );

  const type = useMemo(() => getTypeByProvider(resolvedProvider), [resolvedProvider]);

  const options = useMemo(
    () => ({
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
      html5: {
        vhs: { overrideNative: true },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    }),
    [getFullscreenTarget],
  );

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
    if (!player || !url) return;

    const sourceTypes = getSourceTypes(url, type);
    const sourceKey = `${url}::${sourceTypes.join("|")}`;

    if (lastSourceRef.current === sourceKey) {
      return;
    }

    lastSourceRef.current = sourceKey;

    let attemptIndex = 0;

    const applySource = () => {
      const currentType = sourceTypes[attemptIndex];
      const source = currentType ? [{ src: url, type: currentType }] : [{ src: url }];

      player.error(undefined);
      player.removeClass?.("vjs-error");

      player.src(source);
      player.load();
      void player.play()?.catch(() => undefined);
    };

    const onError = () => {
      const mediaError = player.error();
      if (!mediaError || mediaError.code !== 4) return;

      attemptIndex += 1;
      if (attemptIndex >= sourceTypes.length) return;

      applySource();
    };

    player.on("error", onError);
    applySource();

    return () => {
      player.off("error", onError);
    };
  }, [url, type]);

  useEffect(() => {
    return () => {
      lastSourceRef.current = null;

      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

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
