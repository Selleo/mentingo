import { createContext, useContext, useState, useCallback, useRef } from "react";

import type { VideoProvider } from "@repo/shared";

type VideoState = {
  currentUrl: string | null;
  provider: VideoProvider | null;
  isExternal: boolean;
  placeholderElement: HTMLElement | null;
  index: number | null;
};

type VideoContextValue = {
  setVideo: (
    url: string,
    provider: VideoProvider | null,
    isExternal: boolean,
    onEnded?: () => void,
    index?: number | null,
  ) => void;
  clearVideo: () => void;
  setOnEnded: (onEnded: () => void) => void;
  setPlaceholderElement: (el: HTMLElement | null) => void;
  getOnEnded: () => (() => void) | undefined;
  registerVideoActivator: (url: string, activate: () => void) => () => void;
  activateVideoByUrl: (url: string) => boolean;
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
    provider: null,
    isExternal: false,
    placeholderElement: null,
    index: null,
  });

  const onEndedRef = useRef<(() => void) | undefined>();
  const videoActivatorsRef = useRef(new Map<string, () => void>());

  const setOnEnded = useCallback((onEnded: () => void) => (onEndedRef.current = onEnded), []);

  const setVideo = useCallback(
    (
      url: string,
      provider: VideoProvider | null,
      isExternal: boolean,
      onEnded?: () => void,
      index?: number | null,
    ) => {
      onEndedRef.current = onEnded;

      setState((prev) => {
        const nextIndex = index !== undefined ? index : prev.index;

        if (
          prev.currentUrl === url &&
          prev.provider === provider &&
          prev.isExternal === isExternal &&
          prev.index === nextIndex
        ) {
          return prev;
        }

        return {
          ...prev,
          currentUrl: url,
          provider,
          isExternal,
          index: nextIndex,
        };
      });
    },
    [],
  );

  const clearVideo = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentUrl: null,
      provider: null,
      index: null,
    }));
  }, []);

  const setPlaceholderElement = useCallback((el: HTMLElement | null) => {
    setState((prev) => {
      if (prev.placeholderElement === el) return prev;

      return { ...prev, placeholderElement: el };
    });
  }, []);

  const getOnEnded = useCallback(() => onEndedRef.current, []);

  const registerVideoActivator = useCallback((url: string, activate: () => void) => {
    videoActivatorsRef.current.set(url, activate);

    return () => {
      const current = videoActivatorsRef.current.get(url);
      if (current === activate) {
        videoActivatorsRef.current.delete(url);
      }
    };
  }, []);

  const activateVideoByUrl = useCallback((url: string) => {
    const activate = videoActivatorsRef.current.get(url);

    if (!activate) return false;

    activate();
    return true;
  }, []);

  return (
    <VideoContext.Provider
      value={{
        state,
        setVideo,
        clearVideo,
        setPlaceholderElement,
        getOnEnded,
        registerVideoActivator,
        activateVideoByUrl,
        setOnEnded,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
}
