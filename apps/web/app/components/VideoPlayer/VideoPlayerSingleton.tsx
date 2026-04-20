import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useVideoPreferencesStore } from "~/modules/common/store/useVideoPreferencesStore";

import { shouldShowPlayNextOverlay } from "./autoplayFlow";
import { useAutoplayAction } from "./hooks/useAutoplayAction";
import { useCountdown } from "./hooks/useCountdown";
import { useFullscreenToggle } from "./hooks/useFullscreenToggle";
import { usePlaceholderRect } from "./hooks/usePlaceholderRect";
import { LoaderPlayNext } from "./LoaderPlayNext";
import { VideoPlayer } from "./VideoPlayer";
import { PLAY_NEXT_SECONDS } from "./VideoPlayer.constants";
import { VIDEO_ENDED_SOURCE } from "./VideoPlayer.types";
import { useVideoPlayer } from "./VideoPlayerContext";

import type React from "react";

/**
 * Singleton video player portaled to document.body.
 *
 * Portal to body (not placeholder) is critical for fullscreen persistence:
 * - Native fullscreen on iframe persists when src changes, but only if the DOM element stays mounted
 * - Without portal, React would unmount/remount the player when navigating between video lessons
 * - Portal keeps the same DOM element in body, only updating iframe src - fullscreen survives
 *
 * Position is synced with placeholder via usePlaceholderRect.
 */
export function VideoPlayerSingleton() {
  const { state, getOnEnded, activateVideoByUrl } = useVideoPlayer();
  const { currentUrl, placeholderElement, provider } = state;
  const rect = usePlaceholderRect(placeholderElement, currentUrl);
  const [showPlayNext, setShowPlayNext] = useState(false);
  const [lastRect, setLastRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, isAnyFullscreen } = useFullscreenToggle(containerRef);

  const { autoplay, autoplaySettings } = useVideoPreferencesStore();
  const { onAutoplay } = useAutoplayAction(
    autoplaySettings.currentAction,
    autoplaySettings.nextVideoUrl,
  );

  useEffect(() => {
    setShowPlayNext(false);
  }, [currentUrl]);

  useEffect(() => {
    if (rect) setLastRect(rect);
  }, [rect]);

  const runAutoplay = useCallback(() => {
    setShowPlayNext(false);

    onAutoplay({
      playVideoByUrl: (url) => {
        const activated = activateVideoByUrl(url);

        if (!activated) {
          getOnEnded()?.({ source: VIDEO_ENDED_SOURCE.GO_NEXT_LESSON });
        }
      },
      goToNextLesson: () => {
        getOnEnded()?.({ source: VIDEO_ENDED_SOURCE.GO_NEXT_LESSON });
      },
      autoplayCurrentVideo: () => {
        getOnEnded()?.({ source: VIDEO_ENDED_SOURCE.AUTOPLAY_ACTION });
      },
    });
  }, [activateVideoByUrl, getOnEnded, onAutoplay]);

  const countdown = useCountdown({
    enabled: showPlayNext,
    seconds: PLAY_NEXT_SECONDS,
    onComplete: runAutoplay,
  });

  const handleEnded = useCallback(() => {
    getOnEnded()?.({ source: VIDEO_ENDED_SOURCE.MEDIA_ENDED });

    const shouldShowOverlay = shouldShowPlayNextOverlay({
      autoplayEnabled: autoplay,
      action: autoplaySettings.currentAction,
    });

    setShowPlayNext(shouldShowOverlay);
  }, [autoplay, autoplaySettings.currentAction, getOnEnded]);

  const activeRect = rect ?? lastRect;
  const canRender = (Boolean(activeRect) || isAnyFullscreen) && (currentUrl || showPlayNext);

  if (!canRender) return null;

  const style: React.CSSProperties =
    !activeRect && isAnyFullscreen
      ? {
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 10,
        }
      : {
          position: "fixed",
          top: activeRect?.top ?? 0,
          left: activeRect?.left ?? 0,
          width: activeRect?.width ?? 0,
          height: activeRect?.height ?? 0,
          zIndex: 10,
        };

  return createPortal(
    <div ref={containerRef} style={style} className="relative bg-black">
      {!showPlayNext && currentUrl && (
        <VideoPlayer
          provider={provider ?? VIDEO_EMBED_PROVIDERS.UNKNOWN}
          url={currentUrl}
          onEnded={handleEnded}
          fill={isFullscreen}
          className="size-full"
          getFullscreenTarget={() => containerRef.current}
        />
      )}
      {showPlayNext && (
        <div className="absolute inset-0">
          <LoaderPlayNext
            seconds={countdown}
            totalSeconds={PLAY_NEXT_SECONDS}
            onPlayNext={runAutoplay}
            onCancel={() => {
              setShowPlayNext(false);
            }}
            className="size-full"
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
