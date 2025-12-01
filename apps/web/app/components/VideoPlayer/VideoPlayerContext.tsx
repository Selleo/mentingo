import { createContext, useContext, useState, useCallback } from "react";

type VideoState = {
  currentUrl: string | null;
  isExternal: boolean;
  onEnded?: () => void;
  placeholderElement: HTMLElement | null;
};

type VideoContextValue = {
  setVideo: (url: string, isExternal: boolean, onEnded?: () => void) => void;
  setPlaceholderElement: (el: HTMLElement | null) => void;
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
    placeholderElement: null,
  });

  const setVideo = useCallback((url: string, isExternal: boolean, onEnded?: () => void) => {
    setState((prev) => ({
      ...prev,
      currentUrl: url,
      isExternal,
      onEnded,
    }));
  }, []);

  const setPlaceholderElement = useCallback((el: HTMLElement | null) => {
    setState((prev) => ({ ...prev, placeholderElement: el }));
  }, []);

  return (
    <VideoContext.Provider value={{ state, setVideo, setPlaceholderElement }}>
      {children}
    </VideoContext.Provider>
  );
}
