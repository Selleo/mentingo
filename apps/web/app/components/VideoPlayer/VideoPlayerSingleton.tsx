import { createPortal } from "react-dom";
import ReactPlayer from "react-player/lazy";

import { usePlaceholderRect } from "./hooks/usePlaceholderRect";
import { VideoPlayer as BunnyPlayer } from "./VideoPlayer";
import { useVideoPlayer } from "./VideoPlayerContext";

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
  const { state, getOnEnded } = useVideoPlayer();
  const { currentUrl, isExternal, placeholderElement } = state;
  const rect = usePlaceholderRect(placeholderElement);

  if (!currentUrl || !rect) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    zIndex: 10,
  };

  const handleEnded = () => getOnEnded()?.();

  return createPortal(
    <div style={style} className="bg-black">
      {isExternal ? (
        <ReactPlayer
          url={currentUrl}
          height="100%"
          width="100%"
          playing
          controls
          onEnded={handleEnded}
        />
      ) : (
        <BunnyPlayer initialUrl={currentUrl} handleVideoEnded={handleEnded} />
      )}
    </div>,
    document.body,
  );
}
