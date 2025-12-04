import { createContext, useContext, useState, useCallback, useRef } from "react";

type VideoState = {
  currentUrl: string | null;
  isExternal: boolean;
  placeholderElement: HTMLElement | null;
};

type VideoContextValue = {
  setVideo: (url: string, isExternal: boolean, onEnded?: () => void) => void;
  clearVideo: () => void;
  setPlaceholderElement: (el: HTMLElement | null) => void;
  getOnEnded: () => (() => void) | undefined;
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
    placeholderElement: null,
  });

  const onEndedRef = useRef<(() => void) | undefined>();

  const setVideo = useCallback((url: string, isExternal: boolean, onEnded?: () => void) => {
    onEndedRef.current = onEnded;

    setState((prev) => {
      if (prev.currentUrl === url && prev.isExternal === isExternal) {
        return prev;
      }

      return { ...prev, currentUrl: url, isExternal };
    });
  }, []);

  const clearVideo = useCallback(() => {
    setState((prev) => ({ ...prev, currentUrl: null }));
  }, []);

  const setPlaceholderElement = useCallback((el: HTMLElement | null) => {
    setState((prev) => {
      if (prev.placeholderElement === el) return prev;

      return { ...prev, placeholderElement: el };
    });
  }, []);

  const getOnEnded = useCallback(() => onEndedRef.current, []);

  return (
    <VideoContext.Provider
      value={{ state, setVideo, clearVideo, setPlaceholderElement, getOnEnded }}
    >
      {children}
    </VideoContext.Provider>
  );
}
