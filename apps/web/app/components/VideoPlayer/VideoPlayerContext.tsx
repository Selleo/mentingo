import { createContext, useContext, useState, useCallback } from "react";

type VideoState = {
  currentUrl: string | null;
  isExternal: boolean;
  onEnded?: () => void;
};

type VideoContextValue = {
  setVideo: (url: string, isExternal: boolean, onEnded?: () => void) => void;
  state: VideoState;
};

const VideoContext = createContext<VideoContextValue | null>(null);

export const useVideoPlayer = () => {
  const ctx = useContext(VideoContext);

  if (!ctx) throw new Error("useVideoPlayer must be inside VideoProvider");

  return ctx;
};

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VideoState>({
    currentUrl: null,
    isExternal: false,
    onEnded: undefined,
  });

  const setVideo = useCallback((url: string, isExternal: boolean, onEnded?: () => void) => {
    setState({
      currentUrl: url,
      isExternal,
      onEnded,
    });
  }, []);

  return <VideoContext.Provider value={{ state, setVideo }}>{children}</VideoContext.Provider>;
}
