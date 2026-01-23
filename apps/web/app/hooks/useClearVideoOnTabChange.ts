import { useEffect } from "react";

import { useVideoPlayer } from "~/components/VideoPlayer/VideoPlayerContext";

export function useClearVideoOnTabChange(tabValue: string, changeOnValue: string = "editor") {
  const { clearVideo } = useVideoPlayer();

  useEffect(() => {
    if (tabValue === changeOnValue) {
      clearVideo();
    }
    return () => {
      clearVideo();
    };
  }, [clearVideo, tabValue, changeOnValue]);
}
