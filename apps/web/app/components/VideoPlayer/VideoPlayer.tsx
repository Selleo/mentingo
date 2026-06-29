"use client";

import {
  detectVideoProviderFromUrl,
  type VideoProvider,
  VIDEO_EMBED_PROVIDERS,
} from "@repo/shared";
import { clamp } from "lodash-es";
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
import type { KeyboardEvent } from "react";

interface VideoPlayerProps {
  url: string;
  onAspectRatioChange?: (aspectRatio: VideoAspectRatio) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  focusOnMount?: boolean;
  fill?: boolean;
  className?: string;
  provider: VideoProvider;
  coverageTracking?: VideoCoverageTrackingOptions;
}

type VideoJSType = ReturnType<typeof videojs>;
type VideoJsPlayerWithQualityLevels = VideoJSType & {
  qualityLevels?: () => HlsQualityLevelList;
};
type VideoJsPlayerWithFullscreenSetter = VideoJSType & {
  isFullscreen: {
    (): boolean;
    (isFullscreen: boolean): void;
  };
};
type VideoJsPlayerWithUserActivity = VideoJSType & {
  userActive?: (isActive: boolean) => void;
};

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const HLS_MIME_TYPE = "application/vnd.apple.mpegurl";
const MP4_MIME_TYPE = "video/mp4";
const KEYBOARD_SEEK_SECONDS = 5;
const KEYBOARD_VOLUME_STEP = 0.1;
const KEYBOARD_SHORTCUT_KEYS = [
  " ",
  "enter",
  "arrowleft",
  "arrowright",
  "arrowup",
  "arrowdown",
  "m",
  "f",
  "0",
];
const KEYBOARD_SHORTCUT_IGNORED_TARGET_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[role='button']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='option']",
  "[tabindex]:not([data-video-player-shortcuts])",
  ".vjs-control",
  ".vjs-menu",
  ".mentingo-vjs-quality-selector",
].join(",");
const PLAYER_CONTROLS_TARGET_SELECTOR = [
  ".vjs-control-bar",
  ".vjs-control",
  ".vjs-menu",
  ".mentingo-vjs-quality-selector",
].join(",");

const isKeyboardShortcutIgnoredTarget = (
  target: EventTarget | null,
  currentTarget: HTMLElement,
) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target === currentTarget) return false;

  return Boolean(target.closest(KEYBOARD_SHORTCUT_IGNORED_TARGET_SELECTOR));
};

const isPlayerControlsTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest(PLAYER_CONTROLS_TARGET_SELECTOR));

const getFiniteNumber = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const syncVideoJsFullscreenState = (player: VideoJSType, isFullscreen: boolean) => {
  (player as VideoJsPlayerWithFullscreenSetter).isFullscreen(isFullscreen);
};

const setVideoJsUserActive = (player: VideoJSType | null, isActive: boolean) => {
  (player as VideoJsPlayerWithUserActivity | null)?.userActive?.(isActive);
};

const eventPathIncludesElement = (event: Event, element: Element | null | undefined) => {
  if (!element) return false;

  const path = event.composedPath();
  return path.includes(element);
};

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
  focusOnMount = false,
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
  const controlsInteractionActiveRef = useRef(false);
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
    setVideoJsUserActive(playerRef.current, true);
    setControlsVisible(true);
    clearControlsVisibilityTimer();
  }, [clearControlsVisibilityTimer]);

  const hideControls = useCallback(() => {
    clearControlsVisibilityTimer();
    setVideoJsUserActive(playerRef.current, false);
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

  const togglePlay = useCallback((player: VideoJSType) => {
    if (player.paused()) {
      void player.play()?.catch(() => undefined);
      return;
    }

    player.pause();
  }, []);

  const seekBy = useCallback((player: VideoJSType, secondsDelta: number) => {
    const currentTime = getFiniteNumber(player.currentTime()) ?? 0;
    const duration = getFiniteNumber(player.duration());
    const maxTime = duration ?? Number.MAX_SAFE_INTEGER;

    player.currentTime(clamp(currentTime + secondsDelta, 0, maxTime));
  }, []);

  const setVolumeBy = useCallback((player: VideoJSType, volumeDelta: number) => {
    const currentVolume = getFiniteNumber(player.volume()) ?? 0;
    const nextVolume = clamp(currentVolume + volumeDelta, 0, 1);

    player.volume(nextVolume);

    if (nextVolume > 0 && player.muted()) {
      player.muted(false);
    }
  }, []);

  const toggleFullscreen = useCallback((player: VideoJSType) => {
    const container = containerRef.current;
    const playerElement = player.el();
    const fullscreenElement = document.fullscreenElement;
    const isFullscreen =
      fullscreenElement === container ||
      fullscreenElement === playerElement ||
      player.isFullscreen();

    if (isFullscreen) {
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {
          void player.exitFullscreen()?.catch(() => undefined);
        });
        return;
      }

      void player.exitFullscreen()?.catch(() => undefined);
      return;
    }

    if (container?.requestFullscreen) {
      void container.requestFullscreen().catch(() => {
        void player.requestFullscreen()?.catch(() => undefined);
      });
      return;
    }

    void player.requestFullscreen()?.catch(() => undefined);
  }, []);

  const runKeyboardShortcut = useCallback(
    (
      event: Pick<
        KeyboardEvent<HTMLDivElement> | globalThis.KeyboardEvent,
        "key" | "target" | "preventDefault" | "stopPropagation"
      >,
      currentTarget: HTMLElement,
    ) => {
      if (isPlayerControlsTarget(event.target)) {
        showControls();
      }

      if (isKeyboardShortcutIgnoredTarget(event.target, currentTarget)) return;

      const currentPlayer = playerRef.current;
      if (!currentPlayer || currentPlayer.isDisposed()) return;

      const keyboardShortcutKey = event.key.toLowerCase();

      if (!KEYBOARD_SHORTCUT_KEYS.includes(keyboardShortcutKey)) return;

      event.preventDefault();
      event.stopPropagation();
      showControls();

      switch (keyboardShortcutKey) {
        case " ":
        case "enter":
          togglePlay(currentPlayer);
          return;
        case "arrowleft":
          seekBy(currentPlayer, -KEYBOARD_SEEK_SECONDS);
          return;
        case "arrowright":
          seekBy(currentPlayer, KEYBOARD_SEEK_SECONDS);
          return;
        case "arrowup":
          setVolumeBy(currentPlayer, KEYBOARD_VOLUME_STEP);
          return;
        case "arrowdown":
          setVolumeBy(currentPlayer, -KEYBOARD_VOLUME_STEP);
          return;
        case "0":
          currentPlayer.currentTime(0);
          return;
        case "m":
          currentPlayer.muted(!currentPlayer.muted());
          return;
        case "f":
          toggleFullscreen(currentPlayer);
      }
    },
    [seekBy, setVolumeBy, showControls, toggleFullscreen, togglePlay],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      runKeyboardShortcut(event, event.currentTarget);
    },
    [runKeyboardShortcut],
  );

  useEffect(() => {
    qualityControlHost?.classList.toggle("vjs-hidden", hlsQualityOptions.length === 0);
  }, [hlsQualityOptions.length, qualityControlHost]);

  useEffect(() => {
    if (!focusOnMount) return;

    window.requestAnimationFrame(() => {
      containerRef.current?.focus({ preventScroll: true });
    });
  }, [focusOnMount, url]);

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
    videoElement.setAttribute("data-video-player-shortcuts", "");
    videoElement.setAttribute("tabindex", "0");
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
    const handleHideControls = () => {
      if (controlsInteractionActiveRef.current) {
        showControls();
        return;
      }

      hideControls();
    };
    const handleControlsInteractionStart = (event: Event) => {
      if (!isPlayerControlsTarget(event.target)) return;

      controlsInteractionActiveRef.current = true;
      showControls();
    };
    const handleControlsInteraction = (event: Event) => {
      if (!isPlayerControlsTarget(event.target)) return;

      showControls();
    };
    const handleControlsInteractionEnd = () => {
      controlsInteractionActiveRef.current = false;
    };
    const targets = new Set<HTMLElement>([container]);
    const playerElement = player?.el() as HTMLElement | undefined;

    if (playerElement) {
      targets.add(playerElement);
    }

    targets.forEach((target) => {
      target.addEventListener("mouseenter", handleShowControls);
      target.addEventListener("mousemove", handleShowControls);
      target.addEventListener("pointerdown", handleShowControls);
      target.addEventListener("pointerdown", handleControlsInteractionStart, true);
      target.addEventListener("pointermove", handleControlsInteraction, true);
      target.addEventListener("click", handleControlsInteraction, true);
      target.addEventListener("focusin", handleControlsInteraction, true);
      target.addEventListener("keydown", handleControlsInteraction, true);
      target.addEventListener("pointerleave", handleHideControls);
      target.addEventListener("touchstart", handleShowControls, { passive: true });
      target.addEventListener("mouseleave", handleHideControls);
    });
    document.addEventListener("pointerup", handleControlsInteractionEnd);
    document.addEventListener("pointercancel", handleControlsInteractionEnd);

    return () => {
      targets.forEach((target) => {
        target.removeEventListener("mouseenter", handleShowControls);
        target.removeEventListener("mousemove", handleShowControls);
        target.removeEventListener("pointerdown", handleShowControls);
        target.removeEventListener("pointerdown", handleControlsInteractionStart, true);
        target.removeEventListener("pointermove", handleControlsInteraction, true);
        target.removeEventListener("click", handleControlsInteraction, true);
        target.removeEventListener("focusin", handleControlsInteraction, true);
        target.removeEventListener("keydown", handleControlsInteraction, true);
        target.removeEventListener("pointerleave", handleHideControls);
        target.removeEventListener("touchstart", handleShowControls);
        target.removeEventListener("mouseleave", handleHideControls);
      });
      document.removeEventListener("pointerup", handleControlsInteractionEnd);
      document.removeEventListener("pointercancel", handleControlsInteractionEnd);
    };
  }, [hideControls, player, showControls]);

  useEffect(() => {
    if (!player) return;

    const playerElement = player.el() as HTMLElement;
    const handlePlayerKeyDown = (event: Event) => {
      runKeyboardShortcut(event as globalThis.KeyboardEvent, playerElement);
    };

    playerElement.setAttribute("data-video-player-shortcuts", "");
    playerElement.setAttribute("tabindex", "0");
    playerElement.addEventListener("keydown", handlePlayerKeyDown);

    return () => {
      playerElement.removeEventListener("keydown", handlePlayerKeyDown);
    };
  }, [player, runKeyboardShortcut]);

  useEffect(() => {
    if (!player) return;

    const getEventScope = (event: Event) => {
      const container = containerRef.current;
      const playerElement = player.el();

      if (eventPathIncludesElement(event, container)) return "container";
      if (eventPathIncludesElement(event, playerElement)) return "player";

      return null;
    };
    const handleDocumentPlayerInteraction = (event: Event) => {
      const scope = getEventScope(event);

      if (!scope) return;

      showControls();
    };

    document.addEventListener("pointermove", handleDocumentPlayerInteraction, true);
    document.addEventListener("pointerdown", handleDocumentPlayerInteraction, true);
    document.addEventListener("click", handleDocumentPlayerInteraction, true);
    document.addEventListener("keydown", handleDocumentPlayerInteraction, true);

    return () => {
      document.removeEventListener("pointermove", handleDocumentPlayerInteraction, true);
      document.removeEventListener("pointerdown", handleDocumentPlayerInteraction, true);
      document.removeEventListener("click", handleDocumentPlayerInteraction, true);
      document.removeEventListener("keydown", handleDocumentPlayerInteraction, true);
    };
  }, [player, showControls]);

  useEffect(() => {
    if (!player) return;

    const syncFullscreenState = () => {
      window.requestAnimationFrame(() => {
        const container = containerRef.current;
        const fullscreenElement = document.fullscreenElement;
        const isFullscreen =
          fullscreenElement === container ||
          (!!fullscreenElement && fullscreenElement === player.el());

        syncVideoJsFullscreenState(player, isFullscreen);

        if (!isFullscreen) return;

        showControls();
        if (fullscreenElement instanceof HTMLElement) {
          fullscreenElement.focus({ preventScroll: true });
        }
      });
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, [player, showControls]);

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
      data-video-player-shortcuts
      role="button"
      aria-label="Video player"
      tabIndex={0}
      onKeyDown={handleKeyDown}
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
