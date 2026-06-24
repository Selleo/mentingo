"use client";

import {
  detectVideoProviderFromUrl,
  type VideoProvider,
  VIDEO_EMBED_PROVIDERS,
} from "@repo/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { match } from "ts-pattern";
import videojs from "video.js";

import "video.js/dist/video-js.css";
import "videojs-youtube";
import { cn } from "~/lib/utils";

import { getVideoAspectRatio } from "./aspectRatio";
import {
  applyHlsQualitySelection,
  getHlsQualityLevels,
  getHlsQualityOptions,
  HLS_AUTO_HD_VALUE,
  type HlsQualityLevelList,
  type HlsQualityOption,
  type HlsQualitySelection,
} from "./hlsQuality";
import { addHlsQualityControlComponent } from "./hlsQualityControlComponent";
import { HlsQualitySelector } from "./HlsQualitySelector";
import "./videojs-vimeo-tech";
import "./videoPlayer.css";
import { useVideoCoverageTracker } from "./useVideoCoverageTracker";

import type { VideoAspectRatio } from "./aspectRatio";
import type { VideoCoverageTrackingOptions } from "./videoCoverage.types";

interface VideoPlayerProps {
  url: string;
  onAspectRatioChange?: (aspectRatio: VideoAspectRatio) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  fill?: boolean;
  className?: string;
  provider: VideoProvider;
  coverageTracking?: VideoCoverageTrackingOptions;
}

type VideoJSType = ReturnType<typeof videojs>;
type VideoJsPlayerWithQualityLevels = VideoJSType & {
  qualityLevels?: () => HlsQualityLevelList;
};

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const HLS_MIME_TYPE = "application/vnd.apple.mpegurl";
const MP4_MIME_TYPE = "video/mp4";

const enableCustomControls = (player: VideoJSType) => {
  player.controls(true);
  player.removeClass("vjs-controls-disabled");
  player.removeClass("vjs-using-native-controls");
  player.addClass("vjs-controls-enabled");
};

const getTypeByProvider = (provider: VideoProvider) =>
  match(provider)
    .with(VIDEO_EMBED_PROVIDERS.YOUTUBE, () => "video/youtube")
    .with(VIDEO_EMBED_PROVIDERS.VIMEO, () => "video/vimeo")
    .with(VIDEO_EMBED_PROVIDERS.BUNNY, () => HLS_MIME_TYPE)
    .with(VIDEO_EMBED_PROVIDERS.SELF, () => MP4_MIME_TYPE)
    .otherwise(() => "");

const getSourceTypes = (url: string, type: string, provider: VideoProvider) => {
  const isInternalLessonResource = /\/api\/lesson\/lesson-resource\//i.test(url);

  if (!isInternalLessonResource) return [type].filter(Boolean);

  return Array.from(
    new Set(
      match(provider)
        .with(VIDEO_EMBED_PROVIDERS.BUNNY, () => [HLS_MIME_TYPE])
        .with(VIDEO_EMBED_PROVIDERS.SELF, () => [MP4_MIME_TYPE])
        .otherwise(() => [HLS_MIME_TYPE, type, MP4_MIME_TYPE]),
    ),
  ).filter(Boolean) as string[];
};

const getPlayerAspectRatio = (player: VideoJSType) => {
  const width = player.videoWidth();
  const height = player.videoHeight();

  return getVideoAspectRatio(width, height);
};

export const VideoPlayer = ({
  url,
  provider,
  onAspectRatioChange,
  onEnded,
  autoPlay = false,
  fill = true,
  className,
  coverageTracking,
}: VideoPlayerProps) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [player, setPlayer] = useState<VideoJSType | null>(null);
  const [qualityControlHost, setQualityControlHost] = useState<HTMLDivElement | null>(null);
  const [hlsQualityOptions, setHlsQualityOptions] = useState<HlsQualityOption[]>([]);
  const [hlsQualitySelection, setHlsQualitySelection] =
    useState<HlsQualitySelection>(HLS_AUTO_HD_VALUE);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<VideoJSType | null>(null);
  const userSelectedHlsQualityRef = useRef(false);
  const hlsQualitySelectionRef = useRef<HlsQualitySelection>(HLS_AUTO_HD_VALUE);
  const lastSourceRef = useRef<string | null>(null);
  const resumeAppliedSourceRef = useRef<string | null>(null);
  const onAspectRatioChangeRef = useRef(onAspectRatioChange);
  const onEndedRef = useRef(onEnded);
  const controlsVisibilityTimeoutRef = useRef<number | null>(null);
  const coverage = useVideoCoverageTracker(
    player,
    coverageTracking ?? {
      enabled: false,
    },
  );

  useEffect(() => {
    onAspectRatioChangeRef.current = onAspectRatioChange;
  }, [onAspectRatioChange]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const clearControlsVisibilityTimer = useCallback(() => {
    if (controlsVisibilityTimeoutRef.current === null) return;

    window.clearTimeout(controlsVisibilityTimeoutRef.current);
    controlsVisibilityTimeoutRef.current = null;
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearControlsVisibilityTimer();
  }, [clearControlsVisibilityTimer]);

  const hideControls = useCallback(() => {
    clearControlsVisibilityTimer();
    setControlsVisible(false);
  }, [clearControlsVisibilityTimer]);

  const setHlsSelection = useCallback((selection: HlsQualitySelection) => {
    hlsQualitySelectionRef.current = selection;
    setHlsQualitySelection(selection);
  }, []);

  const syncHlsQuality = useCallback(
    (player: VideoJSType) => {
      const qualityLevelsList = (player as VideoJsPlayerWithQualityLevels).qualityLevels?.();
      const qualityLevels = getHlsQualityLevels(qualityLevelsList);
      const options = getHlsQualityOptions(qualityLevels);
      const currentSelection = hlsQualitySelectionRef.current;
      const selectionExists = options.some((option) => option.value === currentSelection);
      const nextSelection =
        selectionExists && userSelectedHlsQualityRef.current ? currentSelection : HLS_AUTO_HD_VALUE;

      setHlsQualityOptions(options);
      setHlsSelection(nextSelection);

      if (options.length) {
        applyHlsQualitySelection(qualityLevels, nextSelection);
      }
    },
    [setHlsSelection],
  );

  const selectHlsQuality = useCallback(
    (selection: HlsQualitySelection) => {
      const currentPlayer = playerRef.current;
      if (!currentPlayer) return;

      const qualityLevelsList = (currentPlayer as VideoJsPlayerWithQualityLevels).qualityLevels?.();
      const qualityLevels = getHlsQualityLevels(qualityLevelsList);

      userSelectedHlsQualityRef.current = true;
      setHlsSelection(selection);
      applyHlsQualitySelection(qualityLevels, selection);
    },
    [setHlsSelection],
  );

  useEffect(() => {
    qualityControlHost?.classList.toggle("vjs-hidden", hlsQualityOptions.length === 0);
  }, [hlsQualityOptions.length, qualityControlHost]);

  const resolvedProvider = useMemo(
    () => (provider === VIDEO_EMBED_PROVIDERS.UNKNOWN ? detectVideoProviderFromUrl(url) : provider),
    [provider, url],
  );

  const type = useMemo(() => getTypeByProvider(resolvedProvider), [resolvedProvider]);

  const options = useMemo(
    () => ({
      autoplay: autoPlay,
      controls: true,
      inactivityTimeout: 3000,
      loop: false,
      playbackRates: PLAYBACK_RATES,
      bigPlayButton: false,
      responsive: true,
      fluid: false,
      fill: true,
      techOrder: ["html5", "youtube", "Vimeo"],
      html5: {
        vhs: { overrideNative: true },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    }),
    [autoPlay],
  );

  useEffect(() => {
    if (playerRef.current) return;

    const videoElement = document.createElement("video-js");
    videoElement.classList.add("mentingo-video-js");
    videoRef.current?.appendChild(videoElement);

    const player = (playerRef.current = videojs(videoElement, options));
    setPlayer(player);
    const qualityLevels = (player as VideoJsPlayerWithQualityLevels).qualityLevels?.();

    player.ready(() => {
      enableCustomControls(player);
      setQualityControlHost(addHlsQualityControlComponent(player));
    });

    const handleHlsQualitySync = () => syncHlsQuality(player);

    player.on("loadedmetadata", () => {
      const aspectRatio = getPlayerAspectRatio(player);
      if (aspectRatio) onAspectRatioChangeRef.current?.(aspectRatio);
      handleHlsQualitySync();
    });

    player.on("ended", () => {
      onEndedRef.current?.();
    });

    player.on("loadedplaylist", handleHlsQualitySync);
    player.on("loadeddata", handleHlsQualitySync);
    player.on("canplay", handleHlsQualitySync);
    player.on("playing", handleHlsQualitySync);
    qualityLevels?.on("addqualitylevel", handleHlsQualitySync);
    qualityLevels?.on("change", handleHlsQualitySync);

    return () => {
      player.off("loadedplaylist", handleHlsQualitySync);
      player.off("loadeddata", handleHlsQualitySync);
      player.off("canplay", handleHlsQualitySync);
      player.off("playing", handleHlsQualitySync);
      qualityLevels?.off("addqualitylevel", handleHlsQualitySync);
      qualityLevels?.off("change", handleHlsQualitySync);
    };
  }, [options, syncHlsQuality]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !url) return;

    const sourceTypes = getSourceTypes(url, type, resolvedProvider);
    const sourceKey = `${url}::${coverageTracking?.resourceEntityId ?? ""}::${sourceTypes.join("|")}`;

    if (lastSourceRef.current === sourceKey) {
      return;
    }

    lastSourceRef.current = sourceKey;
    resumeAppliedSourceRef.current = null;

    let attemptIndex = 0;

    const applySource = () => {
      const currentType = sourceTypes[attemptIndex];
      const source = currentType ? [{ src: url, type: currentType }] : [{ src: url }];

      player.error(undefined);
      player.removeClass?.("vjs-error");
      enableCustomControls(player);
      userSelectedHlsQualityRef.current = false;
      setHlsQualityOptions([]);
      setHlsSelection(HLS_AUTO_HD_VALUE);

      player.src(source);
      player.load();
      syncHlsQuality(player);
      if (autoPlay) {
        void player.play()?.catch(() => undefined);
      }
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
  }, [
    autoPlay,
    coverageTracking?.resourceEntityId,
    resolvedProvider,
    setHlsSelection,
    syncHlsQuality,
    url,
    type,
  ]);

  useEffect(() => {
    const sourceKey = lastSourceRef.current;
    if (!player || !coverageTracking?.enabled || !sourceKey) return;

    if (resumeAppliedSourceRef.current === sourceKey) return;

    const applyResumeTime = () => {
      const duration = player.duration();
      const resumeTimeSeconds =
        typeof duration === "number" && Number.isFinite(duration) && duration > 0
          ? Math.min(coverage.resumeTimeSeconds, Math.max(0, duration - 0.5))
          : coverage.resumeTimeSeconds;

      if (resumeTimeSeconds > 0) {
        player.currentTime(resumeTimeSeconds);
      }

      resumeAppliedSourceRef.current = sourceKey;
    };

    if (player.readyState() >= 1) {
      applyResumeTime();
      return;
    }

    player.one("loadedmetadata", applyResumeTime);

    return () => {
      player.off("loadedmetadata", applyResumeTime);
    };
  }, [coverage.resumeTimeSeconds, coverageTracking?.enabled, player]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleShowControls = () => showControls();
    const handleHideControls = () => hideControls();

    container.addEventListener("mouseenter", handleShowControls);
    container.addEventListener("mousemove", handleShowControls);
    container.addEventListener("pointerdown", handleShowControls);
    container.addEventListener("pointerleave", handleHideControls);
    container.addEventListener("touchstart", handleShowControls, { passive: true });
    container.addEventListener("mouseleave", handleHideControls);

    return () => {
      container.removeEventListener("mouseenter", handleShowControls);
      container.removeEventListener("mousemove", handleShowControls);
      container.removeEventListener("pointerdown", handleShowControls);
      container.removeEventListener("pointerleave", handleHideControls);
      container.removeEventListener("touchstart", handleShowControls);
      container.removeEventListener("mouseleave", handleHideControls);
    };
  }, [hideControls, showControls]);

  useEffect(() => {
    return () => {
      lastSourceRef.current = null;
      clearControlsVisibilityTimer();
      setQualityControlHost(null);

      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
        setPlayer(null);
      }
    };
  }, [clearControlsVisibilityTimer]);

  useEffect(() => {
    if (!player || !coverageTracking?.showCoverageMarkers) return;

    const holder = player.el()?.querySelector(".vjs-progress-holder") as HTMLElement | null;
    if (!holder) return;

    holder.querySelector(".mentingo-video-coverage-markers")?.remove();

    const durationSeconds = coverage.snapshot.durationSeconds ?? player.duration();
    if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return;

    const markerRoot = document.createElement("div");
    markerRoot.className = "mentingo-video-coverage-markers";

    for (const [start, end] of coverage.snapshot.watchedRanges) {
      const marker = document.createElement("span");
      const left = Math.max(0, Math.min(100, (start / durationSeconds) * 100));
      const width = Math.max(0, Math.min(100 - left, ((end - start) / durationSeconds) * 100));

      marker.className = "mentingo-video-coverage-marker";
      marker.style.left = `${left}%`;
      marker.style.width = `${width}%`;
      markerRoot.appendChild(marker);
    }

    holder.appendChild(markerRoot);

    return () => {
      markerRoot.remove();
    };
  }, [
    coverage.snapshot.durationSeconds,
    coverage.snapshot.watchedRanges,
    coverageTracking?.showCoverageMarkers,
    player,
  ]);

  return (
    <div
      ref={containerRef}
      data-vjs-player
      className={cn(
        "relative w-full overflow-hidden bg-black",
        !controlsVisible && "mentingo-video-player--controls-hidden",
        fill ? "h-full" : "aspect-video",
        className,
      )}
    >
      <div ref={videoRef} className="size-full" />
      {qualityControlHost &&
        createPortal(
          <HlsQualitySelector
            options={hlsQualityOptions}
            selection={hlsQualitySelection}
            onSelect={selectHlsQuality}
          />,
          qualityControlHost,
        )}
    </div>
  );
};
