import { useEffect, useRef, useState } from "react";
import videojs from "video.js";

import "video.js/dist/video-js.css";
import "~/components/VideoPlayer/videoPlayer.css";
import { cn } from "~/lib/utils";

type VideoJsPlayer = ReturnType<typeof videojs>;
type HeroPlaylist = {
  attributes?: { RESOLUTION?: { height?: number } };
  excludeUntil?: number;
};
type HeroVhs = {
  playlists: { main: { playlists: HeroPlaylist[] } };
  selectPlaylist: () => HeroPlaylist | undefined;
};

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
          // Never run VHS's alternative low-initial selector for this decorative player.
          enableLowInitialPlaylist: false,
          limitRenditionByPlayerDimensions: false,
          useNetworkInformationApi: false,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    }));

    // This decorative video must never trade sharpness for continued playback.
    let stopped = false;
    let started = false;
    const isHls = getVideoType(src) === "application/vnd.apple.mpegurl";
    let selected: HeroPlaylist | undefined;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const clearTimers = () => {
      clearTimeout(startupTimer);
      clearTimeout(stallTimer);
      stallTimer = undefined;
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimers();
      setFirstFrameLoaded(false);
      if (!player.isDisposed()) player.dispose();
    };
    // Include manifest loading in the startup budget, not just media decoding.
    const startupTimer = setTimeout(stop, 4000);
    const onPlaying = () => {
      if (stopped) return;
      if (isHls && !selected) {
        stop();
        return;
      }
      started = true;
      clearTimers();
      setFirstFrameLoaded(true);
    };
    const onWaiting = () => {
      if (!started || stopped || stallTimer) return;
      stallTimer = setTimeout(stop, 2000);
    };
    const onStalled = () => {
      if (player.readyState() < 3) onWaiting();
    };
    player.on("playing", onPlaying);
    player.on("waiting", onWaiting);
    player.on("stalled", onStalled);
    player.on("error", stop);

    const installFixedSelector = () => {
      if (stopped || !isHls) return;
      // VHS emits this before starting its source/manifest loader. src() itself is async
      // through Video.js middleware, so checking tech().vhs immediately after src() races.
      const { vhs } = player.tech({ IWillNotUseThisInPlugins: true }) as unknown as {
        vhs?: HeroVhs;
      };
      if (!vhs) {
        stop();
        return;
      }
      vhs.selectPlaylist = () => {
        if (stopped) return undefined;
        if (!selected) {
          const variants = vhs.playlists.main.playlists;
          selected =
            variants.find((p) => p.attributes?.RESOLUTION?.height === 1080) ??
            variants.find((p) => p.attributes?.RESOLUTION?.height === 720);
          // VHS's loader otherwise requests playlists[0] when the selector returns nothing.
          // Empty only this player's manifest before disposing on the next microtask.
          if (!selected) variants.length = 0;
        }
        if (!selected || (selected.excludeUntil ?? 0) > Date.now()) {
          // Do not dispose inside VHS's selection stack; it still owns that callback.
          void Promise.resolve().then(stop);
          return undefined;
        }
        return selected;
      };
    };
    player.on("xhr-hooks-ready", installFixedSelector);

    player.ready(() => {
      if (stopped) return;
      player.muted(true);
      player.loop(true);
      player.src([{ src, type: getVideoType(src) }]);
      player.load();
      void player.play()?.catch(stop);
    });

    return () => {
      stopped = true;
      clearTimers();
      if (!player.isDisposed()) {
        player.off("playing", onPlaying);
        player.off("waiting", onWaiting);
        player.off("stalled", onStalled);
        player.off("error", stop);
        player.off("xhr-hooks-ready", installFixedSelector);
        player.dispose();
      }

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
