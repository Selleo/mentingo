import { useCallback, useEffect, useRef, useState } from "react";

import type { MinimumVisibleDurationControls } from "./useMinimumVisibleDuration.types";

export function useMinimumVisibleDuration(
  minimumDurationMs: number,
): MinimumVisibleDurationControls {
  const [isVisible, setIsVisible] = useState(false);
  const startedAt = useRef(0);
  const completionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (completionTimeout.current) clearTimeout(completionTimeout.current);
    },
    [],
  );

  const start = useCallback(() => {
    if (completionTimeout.current) clearTimeout(completionTimeout.current);

    startedAt.current = Date.now();
    setIsVisible(true);
  }, []);

  const stop = useCallback(() => {
    if (completionTimeout.current) clearTimeout(completionTimeout.current);

    setIsVisible(false);
  }, []);

  const afterMinimumDuration = useCallback(
    (onReady: () => void) => {
      const remainingTime = minimumDurationMs - (Date.now() - startedAt.current);

      if (remainingTime > 0) {
        completionTimeout.current = setTimeout(onReady, remainingTime);
      } else {
        onReady();
      }
    },
    [minimumDurationMs],
  );

  return { isVisible, start, afterMinimumDuration, stop };
}
