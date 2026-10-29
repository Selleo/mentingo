import { useEffect, useRef, useState } from "react";
import videojs from "video.js";

import "video.js/dist/video-js.css";
import "~/components/VideoPlayer/videoPlayer.css";
import { cn } from "~/lib/utils";

type VideoJsPlayer = ReturnType<typeof videojs>;

type HeroTrailerVideoProps = {
  src: string;
};

const getVideoType = (src: string) =>
  /\.m3u8($|\?)/i.test(src) ? "application/vnd.apple.mpegurl" : "video/mp4";

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
        vhs: {
          overrideNative: true,
          // Start at the highest bitrate; VHS replaces this estimate with measured bandwidth.
          bandwidth: Number.MAX_SAFE_INTEGER,
          limitRenditionByPlayerDimensions: false,
          // A browser downlink hint must not override the initial bandwidth estimate.
          useNetworkInformationApi: false,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    }));

    const markFirstFrameLoaded = () => setFirstFrameLoaded(true);

    player.ready(() => {
      player.muted(true);
      player.loop(true);
      player.src([{ src, type: getVideoType(src) }]);
      player.load();
      void player.play()?.catch(() => undefined);
    });

    player.on("loadeddata", markFirstFrameLoaded);
    player.on("playing", markFirstFrameLoaded);

    return () => {
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
