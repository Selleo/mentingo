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
  const rect = usePlaceholderRect(placeholderElement);
  const [showPlayNext, setShowPlayNext] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen } = useFullscreenToggle(containerRef);

  const { autoplay, autoplaySettings } = useVideoPreferencesStore();
  const { onAutoplay } = useAutoplayAction(
    autoplaySettings.currentAction,
    autoplaySettings.nextVideoUrl,
  );

  useEffect(() => {
    setShowPlayNext(false);
  }, [currentUrl]);

  const runAutoplay = useCallback(() => {
    setShowPlayNext(false);

    onAutoplay({
      playVideoByUrl: (url) => {
        const activated = activateVideoByUrl(url);

        if (!activated) {
          getOnEnded()?.();
        }
      },
      goToNextLesson: () => {
        getOnEnded()?.();
      },
      autoplayCurrentVideo: () => {
        getOnEnded()?.();
      },
    });
  }, [activateVideoByUrl, getOnEnded, onAutoplay]);

  const countdown = useCountdown({
    enabled: showPlayNext,
    seconds: PLAY_NEXT_SECONDS,
    onComplete: runAutoplay,
  });

  const handleEnded = useCallback(() => {
    setShowPlayNext(
      shouldShowPlayNextOverlay({
        autoplayEnabled: autoplay,
        action: autoplaySettings.currentAction,
      }),
    );
  }, [autoplay, autoplaySettings]);

  const canRender = !!rect && (currentUrl || showPlayNext);

  if (!canRender) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
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
