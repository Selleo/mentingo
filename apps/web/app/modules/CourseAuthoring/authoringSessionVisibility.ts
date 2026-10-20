import { useLayoutEffect } from "react";
import { createStore } from "zustand/vanilla";

/** Counts visible hosts so closing one cannot hide a session still open elsewhere. */
export const authoringSessionVisibility = createStore<Record<string, number>>(() => ({}));

export const authoringSessionVisibilityKey = (courseId: string, sessionId: string) =>
  JSON.stringify([courseId, sessionId]);

/** Hosts publish visibility independently of the session controller's background lifetime. */
export const useVisibleAuthoringSession = (
  courseId: string,
  sessionId: string | null | undefined,
  visible = true,
) => {
  useLayoutEffect(() => {
    if (!visible || !sessionId) return;
    const key = authoringSessionVisibilityKey(courseId, sessionId);
    authoringSessionVisibility.setState((state) => ({ [key]: (state[key] ?? 0) + 1 }));
    return () => {
      authoringSessionVisibility.setState((state) => {
        const next = { ...state };
        if (next[key] > 1) next[key] -= 1;
        else delete next[key];
        return next;
      }, true);
    };
  }, [courseId, sessionId, visible]);
};
