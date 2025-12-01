import { useEffect, useRef } from "react";

import { useVideoPlayer } from "./VideoPlayerContext";

type Props = {
  url: string | null;
  isExternalUrl?: boolean;
  onVideoEnded?: () => void;
};

export function Video({ url, isExternalUrl = false, onVideoEnded }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { setVideo, setPlaceholderElement } = useVideoPlayer();

  useEffect(() => {
    if (!url) return;

    setVideo(url, isExternalUrl, onVideoEnded);
  }, [url, isExternalUrl, onVideoEnded, setVideo]);

  useEffect(() => {
    setPlaceholderElement(ref.current);

    return () => setPlaceholderElement(null);
  }, [setPlaceholderElement]);

  return <div ref={ref} className="w-full aspect-video" />;
}
