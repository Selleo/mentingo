import { useEffect, useRef, useState, useCallback } from "react";

import { cn } from "~/lib/utils";

interface VideoPlayerProps {
  initialUrl: string;
  handleVideoEnded?: () => void;
}

interface PlayerJSPlayer {
  on: (event: "ready" | "ended", callback: () => void) => void;
  off: (event: "ready" | "ended", callback: () => void) => void;
  destroy?: () => void;
}

declare global {
  interface Window {
    playerjs?: {
      Player: new (el: HTMLIFrameElement) => PlayerJSPlayer;
    };
  }
}

export const VideoPlayer = ({ initialUrl, handleVideoEnded }: VideoPlayerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<PlayerJSPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !window.playerjs) return;

    try {
      const player = new window.playerjs.Player(iframe);
      playerRef.current = player;

      const onReady = () => setIsLoading(false);
      player.on("ready", onReady);

      if (handleVideoEnded) {
        player.on("ended", handleVideoEnded);
      }
    } catch (error) {
      console.warn("Player initialization failed:", error);
    }
  }, [handleVideoEnded]);

  useEffect(() => {
    const iframe = iframeRef.current;
    const player = playerRef.current;

    return () => {
      try {
        if (player && iframe?.contentWindow) {
          player.off("ready", () => {});
          if (handleVideoEnded) {
            player.off("ended", handleVideoEnded);
          }
          player.destroy?.();
        }
      } catch (err) {
        console.warn("Error during player cleanup:", err);
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
        className={cn("size-full border-none", {
          "opacity-0": isLoading,
          "opacity-100": !isLoading,
        })}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        title="Video Player"
        loading="lazy"
      />
    </div>
  );
};
