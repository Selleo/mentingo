import { useCallback, useEffect, useState } from "react";

export const useFullscreenToggle = (containerRef: React.RefObject<HTMLElement | null>) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAnyFullscreen, setIsAnyFullscreen] = useState(false);

  useEffect(() => {
    const updateFullscreen = () => {
      const fullscreenElement = document.fullscreenElement;
      setIsAnyFullscreen(!!fullscreenElement);
      setIsFullscreen(fullscreenElement === containerRef.current);
    };

    updateFullscreen();
    document.addEventListener("fullscreenchange", updateFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreen);
    };
  }, [containerRef]);

  const enter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    void el.requestFullscreen().catch(() => {});
  }, [containerRef]);

  const exit = useCallback(() => {
    if (!document.fullscreenElement) return;
    void document.exitFullscreen().catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      exit();
      return;
    }
    enter();
  }, [enter, exit]);

  return { isFullscreen, isAnyFullscreen, enter, exit, toggle };
};
