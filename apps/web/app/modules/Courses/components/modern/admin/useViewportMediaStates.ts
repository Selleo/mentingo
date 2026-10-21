import { useCallback, useEffect, useState } from "react";

import type { CourseCardMediaState } from "../ModernCourseCard.types";

export const MEDIA_ITEM_ATTRIBUTE = "data-media-id";

const PLAY_THRESHOLD = 0.25;
// The picker shows 2.5 rows, so 80% of its height below the fold covers roughly the next 4 cards.
const PRELOAD_ROOT_MARGIN = "0px 0px 80% 0px";

const trackIntersections =
  (setIds: (update: (current: Set<string>) => Set<string>) => void) =>
  (entries: IntersectionObserverEntry[]) =>
    setIds((current) => {
      const next = new Set(current);
      entries.forEach((entry) => {
        const id = (entry.target as HTMLElement).dataset.mediaId;
        if (!id) return;

        if (entry.isIntersecting) next.add(id);
        else next.delete(id);
      });

      return next;
    });

export function useViewportMediaStates(root: HTMLElement | null, itemsKey: string) {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());
  const [nearIds, setNearIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!root) return;

    const visibleObserver = new IntersectionObserver(trackIntersections(setVisibleIds), {
      root,
      threshold: PLAY_THRESHOLD,
    });
    const nearObserver = new IntersectionObserver(trackIntersections(setNearIds), {
      root,
      rootMargin: PRELOAD_ROOT_MARGIN,
    });

    root.querySelectorAll(`[${MEDIA_ITEM_ATTRIBUTE}]`).forEach((item) => {
      visibleObserver.observe(item);
      nearObserver.observe(item);
    });

    return () => {
      visibleObserver.disconnect();
      nearObserver.disconnect();
      setVisibleIds(new Set());
      setNearIds(new Set());
    };
  }, [root, itemsKey]);

  return useCallback(
    (id: string): CourseCardMediaState => {
      if (visibleIds.has(id)) return "play";
      if (nearIds.has(id)) return "preload";

      return "idle";
    },
    [visibleIds, nearIds],
  );
}
