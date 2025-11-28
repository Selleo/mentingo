import ReactPlayer from "react-player/lazy";

import { VideoPlayer as InternalPlayer } from "./VideoPlayer";
import { useVideoPlayer } from "./VideoPlayerContext";

export function VideoPlayerSingleton() {
  const { state } = useVideoPlayer();
  const { currentUrl, isExternal, onEnded } = state;

  if (!currentUrl) return null;

  return (
    <div className="w-full aspect-video">
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
        <InternalPlayer initialUrl={currentUrl} handleVideoEnded={onEnded} />
      )}
    </div>
  );
}
