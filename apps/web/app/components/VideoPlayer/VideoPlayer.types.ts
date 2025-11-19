export type VideoPlayerProps = {
  url: string | null;
  onVideoEnded?: () => void;
  isExternalUrl?: boolean;
  autoplay?: boolean;
  onPlaybackReady?: () => void;
  resumeFullscreen?: boolean;
  onFullscreenHandled?: () => void;
};
