import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "~/lib/utils";

interface VideoPlayerProps {
  initialUrl: string;
  handleVideoEnded?: () => void;
  shouldAutoplay?: boolean;
  onPlaybackReady?: () => void;
  resumeFullscreen?: boolean;
  onFullscreenHandled?: () => void;
}

interface PlayerJSPlayer {
  on: (event: "ready" | "ended", callback: () => void) => void;
  off: (event: "ready" | "ended", callback: () => void) => void;
  destroy?: () => void;
  play?: () => void;
  api?: (command: string, value?: unknown) => void;
}

declare global {
  interface Window {
    playerjs?: {
      Player: new (el: HTMLIFrameElement) => PlayerJSPlayer;
    };
  }
}

export const VideoPlayer = ({
  initialUrl,
  handleVideoEnded,
  shouldAutoplay = false,
  onPlaybackReady,
  resumeFullscreen = false,
  onFullscreenHandled,
}: VideoPlayerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<PlayerJSPlayer | null>(null);
  const readyCallbackRef = useRef<(() => void) | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const requestNativeFullscreen = () => {
    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    iframe.requestFullscreen();
  };

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !window.playerjs) return;

    try {
      const player = new window.playerjs.Player(iframe);
      playerRef.current = player;

      const onReady = () => {
        setIsLoading(false);

        if (shouldAutoplay) {
          try {
            player.play?.();
          } catch {
            player.api?.("play");
          }
        }

        onPlaybackReady?.();

        const markFullscreenHandled = () => onFullscreenHandled?.();

        if (resumeFullscreen) {
          console.log("Enabling fullscreen…");

          try {
            player.api?.("fullscreen", 1);
          } catch (err) {
            requestNativeFullscreen();
            console.warn("PlayerJS fullscreen failed:", err);
          }
        } else {
          markFullscreenHandled();
        }
      };

      readyCallbackRef.current = onReady;
      player.on("ready", onReady);

      if (handleVideoEnded) {
        player.on("ended", handleVideoEnded);
      }
    } catch (err) {
      console.warn("PlayerJS init failed:", err);
    }
  }, [handleVideoEnded, onFullscreenHandled, onPlaybackReady, resumeFullscreen, shouldAutoplay]);

  useEffect(() => {
    return () => {
      const player = playerRef.current;
      if (!player) return;

      try {
        if (readyCallbackRef.current) {
          player.off("ready", readyCallbackRef.current);
        }
        if (handleVideoEnded) {
          player.off("ended", handleVideoEnded);
        }
        player.destroy?.();
      } catch (err) {
        console.warn("Destroy error:", err);
      }
    };
  }, [handleVideoEnded]);

  return (
    <div className="relative aspect-video w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="size-12 animate-spin rounded-full border-y-2 border-primary-500" />
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={initialUrl}
        onLoad={handleIframeLoad}
        className={cn("size-full border-none transition-opacity duration-300", {
          "opacity-0": isLoading,
          "opacity-100": !isLoading,
        })}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        title="Video Player"
      />
    </div>
  );
};
