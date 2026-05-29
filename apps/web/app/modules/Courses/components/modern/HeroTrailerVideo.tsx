import { useEffect, useRef, useState } from "react";
import videojs from "video.js";

import "video.js/dist/video-js.css";
import "~/components/VideoPlayer/videoPlayer.css";
import { cn } from "~/lib/utils";

const MIN_HLS_RENDITION_HEIGHT = 720;
const MAX_HLS_RENDITION_HEIGHT = 1080;

type VideoJsPlayer = ReturnType<typeof videojs>;

type VhsRepresentation = {
  height?: number;
  enabled: (enabled?: boolean) => boolean;
};

type VideoJsTechWithVhs = {
  vhs?: {
    representations?: () => VhsRepresentation[];
  };
};

type HeroTrailerVideoProps = {
  src: string;
};

const getVideoType = (src: string) =>
  /\.m3u8($|\?)/i.test(src) ? "application/vnd.apple.mpegurl" : "video/mp4";

const getFallbackRepresentation = (representations: VhsRepresentation[]) =>
  representations
    .filter((representation) => {
      const height = representation.height;
      return typeof height === "number" && height < MIN_HLS_RENDITION_HEIGHT;
    })
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];

const enforceTargetHlsRepresentation = (player: VideoJsPlayer) => {
  const tech = player.tech() as VideoJsTechWithVhs | undefined;
  const representations = tech?.vhs?.representations?.() ?? [];
  const fallbackRepresentation = getFallbackRepresentation(representations);

  const hasTargetRangeRepresentation = representations.some((representation) => {
    const height = representation.height;
    return (
      typeof height === "number" &&
      height >= MIN_HLS_RENDITION_HEIGHT &&
      height <= MAX_HLS_RENDITION_HEIGHT
    );
  });

  if (!hasTargetRangeRepresentation && !fallbackRepresentation) return;

  representations.forEach((representation) => {
    const height = representation.height;
    const isInTargetRange =
      typeof height === "number" &&
      height >= MIN_HLS_RENDITION_HEIGHT &&
      height <= MAX_HLS_RENDITION_HEIGHT;

    representation.enabled(
      hasTargetRangeRepresentation ? isInTargetRange : representation === fallbackRepresentation,
    );
  });
};

export function HeroTrailerVideo({ src }: HeroTrailerVideoProps) {
  const playerRef = useRef<VideoJsPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [firstFrameLoaded, setFirstFrameLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || playerRef.current) return;

    setFirstFrameLoaded(false);

    const videoElement = document.createElement("video-js");
    videoElement.classList.add("mentingo-video-js", "mentingo-video-js--cover");
    videoElement.setAttribute("playsinline", "true");
    containerRef.current.appendChild(videoElement);

    const player = (playerRef.current = videojs(videoElement, {
      autoplay: "muted",
      controls: false,
      fill: true,
      loop: true,
      muted: true,
      responsive: true,
      techOrder: ["html5"],
      html5: {
        vhs: { overrideNative: true },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    }));

    const applyPreferredRepresentation = () => enforceTargetHlsRepresentation(player);
    const markFirstFrameLoaded = () => setFirstFrameLoaded(true);

    player.ready(() => {
      player.muted(true);
      player.loop(true);
      player.src([{ src, type: getVideoType(src) }]);
      player.load();
      void player.play()?.catch(() => undefined);
    });

    player.on("loadedmetadata", applyPreferredRepresentation);
    player.on("loadedplaylist", applyPreferredRepresentation);
    player.on("loadeddata", markFirstFrameLoaded);
    player.on("playing", markFirstFrameLoaded);

    return () => {
      player.off("loadedmetadata", applyPreferredRepresentation);
      player.off("loadedplaylist", applyPreferredRepresentation);
      player.off("loadeddata", markFirstFrameLoaded);
      player.off("playing", markFirstFrameLoaded);

      if (!player.isDisposed()) player.dispose();

      playerRef.current = null;
    };
  }, [src]);

  return (
    <div
      ref={containerRef}
      data-vjs-player
      className={cn(
        "size-full transition-opacity duration-300",
        firstFrameLoaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
