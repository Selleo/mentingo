import { useEffect, useState } from "react";

export function useIsWidthBetween(minWidth: number, maxWidth: number, initialState = false) {
  const [isBetween, setIsBetween] = useState<boolean>(() => {
    if (typeof window === "undefined") return initialState;
    const w = window.innerWidth;
    return w >= minWidth && w <= maxWidth;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(min-width: ${minWidth}px) and (max-width: ${maxWidth}px)`);

    const mqWithLegacy = mq as MediaQueryList & {
      addListener?: (listener: (mql: MediaQueryList) => void) => void;
      removeListener?: (listener: (mql: MediaQueryList) => void) => void;
    };

    const handleEvent = (e: Event) => {
      const me = e as MediaQueryListEvent;
      setIsBetween(me.matches);
    };

    const handleLegacy = (mql: MediaQueryList) => {
      setIsBetween(mql.matches);
    };

    setIsBetween(mq.matches);

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handleEvent as EventListener);
    } else if (typeof mqWithLegacy.addListener === "function") {
      mqWithLegacy.addListener(handleLegacy);
    }

    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", handleEvent as EventListener);
      } else if (typeof mqWithLegacy.removeListener === "function") {
        mqWithLegacy.removeListener(handleLegacy);
      }
    };
  }, [minWidth, maxWidth]);

  return isBetween;
}

export default useIsWidthBetween;
