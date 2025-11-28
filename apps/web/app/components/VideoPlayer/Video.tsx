import { useEffect } from "react";

import { useVideoPlayer } from "./VideoPlayerContext";

type Props = {
  url: string;
  isExternalUrl: boolean;
  onVideoEnded?: () => void;
};

export function Video({ url, isExternalUrl, onVideoEnded }: Props) {
  const { setVideo } = useVideoPlayer();

  useEffect(() => {
    setVideo(url, isExternalUrl, onVideoEnded);
  }, [url, isExternalUrl, onVideoEnded, setVideo]);

  return (
    <div className="w-full">
      <VideoPlayerPlaceholder />
    </div>
  );
}

function VideoPlayerPlaceholder() {
  return <div className="w-full aspect-video bg-black rounded-md" />;
}
