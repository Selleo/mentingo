import ReactPlayer from "react-player/lazy";

import { useUserRole } from "~/hooks/useUserRole";

import { VideoPlayer } from "./VideoPlayer";

import type { VideoPlayerProps } from "./VideoPlayer.types";

export const Video = ({ url, onVideoEnded, isExternalUrl }: VideoPlayerProps) => {
  const { isAdmin } = useUserRole();

  if (!url) throw new Error("Something went wrong");

  if (isExternalUrl) {
    return (
      <div className="aspect-video w-full">
        <ReactPlayer
          url={url}
          controls
          height="100%"
          width="100%"
          {...(!isAdmin && { onEnded: onVideoEnded })}
        />
      </div>
    );
  }

  return <VideoPlayer initialUrl={url} handleVideoEnded={onVideoEnded} />;
};
