import { useRef } from "react";
import { createPortal } from "react-dom";
import ReactPlayer from "react-player/lazy";

import { useFullscreen } from "./hooks/useFullscreen";
import { usePlaceholderRect } from "./hooks/usePlaceholderRect";
import { VideoPlayer as BunnyPlayer } from "./VideoPlayer";
import { useVideoPlayer } from "./VideoPlayerContext";

export function VideoPlayerSingleton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state } = useVideoPlayer();
  const { currentUrl, isExternal, onEnded, placeholderElement } = state;

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  const rect = usePlaceholderRect(placeholderElement, isFullscreen);

  if (!currentUrl) return null;
  if (!isFullscreen && !rect) return null;

  const style: React.CSSProperties = isFullscreen
    ? { position: "fixed", inset: 0, zIndex: 9999 }
    : {
        position: "fixed",
        top: rect!.top,
        left: rect!.left,
        width: rect!.width,
        height: rect!.height,
        zIndex: 10,
      };

  return createPortal(
    <div ref={containerRef} style={style} className="bg-black">
      <button
        onClick={toggleFullscreen}
        className="pointer-events-auto absolute right-[10px] bottom-[10px] z-10 flex size-8 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 border border-red-700"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      />

      {isExternal ? (
        <ReactPlayer
          url={currentUrl}
          height="100%"
          width="100%"
          playing
          controls
          onEnded={onEnded}
        />
      ) : (
        <BunnyPlayer initialUrl={currentUrl} handleVideoEnded={onEnded} />
      )}
    </div>,
    document.body,
  );
}
