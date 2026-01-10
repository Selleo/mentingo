import { useEffect, useRef } from "react";

import { useVideoPlayer } from "./VideoPlayerContext";

type Props = {
  src?: string | null;
  url?: string | null;
  isExternal?: boolean;
  isExternalUrl?: boolean;
  onVideoEnded?: () => void;
};

export function Video({ src, url, isExternal, isExternalUrl = false, onVideoEnded }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { setVideo, setPlaceholderElement } = useVideoPlayer();
  const resolvedUrl = src ?? url ?? null;
  const resolvedExternal = isExternal ?? isExternalUrl;

  useEffect(() => {
    if (!resolvedUrl) return;

    setVideo(resolvedUrl, resolvedExternal, onVideoEnded);
  }, [resolvedUrl, resolvedExternal, onVideoEnded, setVideo]);

  useEffect(() => {
    setPlaceholderElement(ref.current);

    return () => setPlaceholderElement(null);
  }, [setPlaceholderElement]);

  return <div ref={ref} className="w-full aspect-video" />;
}
