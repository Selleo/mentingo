import { useEffect, useRef, useState } from "react";

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

interface WindowWithPlayerJS extends Window {
  playerjs?: {
    Player: new (el: HTMLIFrameElement) => PlayerJSPlayer;
  };
}

export const VideoPlayer = ({ initialUrl, handleVideoEnded }: VideoPlayerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<PlayerJSPlayer | null>(null);
  const isMountedRef = useRef(true);
  const cleanupRef = useRef<() => void>(() => {});
  const [isLoading, setIsLoading] = useState(true);

  const getPlayerUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set("autoplay", "false");
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const iframe = iframeRef.current;
    setIsLoading(true);

    const initializePlayer = () => {
      if (!isMountedRef.current || !iframeRef.current || !initialUrl) return;

      try {
        const PlayerConstructor = (
          window as {
            playerjs?: { Player: new (el: HTMLIFrameElement) => PlayerJSPlayer };
          }
        ).playerjs?.Player;

        if (!PlayerConstructor) return;

        if (!document.body.contains(iframeRef.current)) {
          return;
        }

        playerRef.current = new PlayerConstructor(iframeRef.current);

        const readyHandler = () => {
          if (!isMountedRef.current || !playerRef.current) return;
          setIsLoading(false);

          const endedHandler = () => {
            console.log("Video ended");
            handleVideoEnded?.();
          };

          playerRef.current.on("ended", endedHandler);

          cleanupRef.current = () => {
            try {
              if (playerRef.current && document.body.contains(iframeRef.current!)) {
                playerRef.current.off("ended", endedHandler);
              }
            } catch (e) {
              console.error("Error removing ended handler:", e);
            }
          };
        };

        playerRef.current.on("ready", readyHandler);

        const readyCleanup = () => {
          try {
            if (playerRef.current && document.body.contains(iframeRef.current!)) {
              playerRef.current.off("ready", readyHandler);
            }
          } catch (e) {
            console.error("Error removing ready handler:", e);
          }
        };

        const previousCleanup = cleanupRef.current;
        cleanupRef.current = () => {
          previousCleanup();
          readyCleanup();
        };
      } catch (error) {
        console.error("PlayerJS initialization error:", error);
        setIsLoading(false);
      }
    };

    if (iframe) {
      iframe.addEventListener("load", () => setIsLoading(false));
    }

    if ((window as WindowWithPlayerJS).playerjs) {
      initializePlayer();
    } else {
      const scriptId = "playerjs-script";
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "//assets.mediadelivery.net/playerjs/playerjs-latest.min.js";
        script.async = true;

        const scriptLoadHandler = () => {
          script.setAttribute("data-loaded", "true");
          initializePlayer();
        };

        script.onload = scriptLoadHandler;
        script.onerror = () => {
          console.error("Failed to load PlayerJS script");
          setIsLoading(false);
        };

        document.body.appendChild(script);
      } else if (script.getAttribute("data-loaded") === "true") {
        initializePlayer();
      }
    }

    return () => {
      isMountedRef.current = false;

      if (iframe) {
        iframe.removeEventListener("load", () => setIsLoading(false));
      }

      cleanupRef.current();

      if (playerRef.current) {
        try {
          if (iframe && document.body.contains(iframe)) {
            playerRef.current.destroy?.();
          }
        } catch (e) {
          console.error("Error destroying player:", e);
        } finally {
          playerRef.current = null;
        }
      }
    };
  }, [initialUrl, handleVideoEnded]);

  return (
    <div className="relative aspect-video w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="size-12 animate-spin rounded-full border-y-2 border-blue-500" />
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={getPlayerUrl(initialUrl)}
        className={cn("size-full border-none", {
          "opacity-0": isLoading,
          "opacity-100": !isLoading,
        })}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Video Player"
        loading="lazy"
      />
    </div>
  );
};
