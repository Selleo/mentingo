import { isAxiosError } from "axios";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { refreshAuthoringSession } from "~/api/queries/useCourseAuthoringSessionQuery";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";
import { observeAuthoringWork } from "~/modules/CourseAuthoring/authoringNotifications";
import { isUnavailableAuthoringSession } from "~/modules/CourseAuthoring/authoringSessionRecovery";
import {
  authoringSessionVisibility,
  authoringSessionVisibilityKey,
} from "~/modules/CourseAuthoring/authoringSessionVisibility";

/** Keeps observed requests visible after closing the drawer or selecting another session. */
export const useGlobalCourseAuthoringNotifications = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const actorId = useCurrentUserStore((state) => state.currentUser?.id);
  const lastActor = useRef(actorId);
  const presentation = useRef({ t, toast });
  presentation.current = { t, toast };

  useEffect(() => {
    if (!isLoggedIn || !actorId) return;
    const seedCachedSessions = lastActor.current === actorId;
    lastActor.current = actorId;
    let active = true;
    const notices = new Map<string, ReturnType<typeof toast>>();
    const isCurrentActor = () =>
      active &&
      useAuthStore.getState().isLoggedIn &&
      useCurrentUserStore.getState().currentUser?.id === actorId;
    const unsubscribeVisibility = authoringSessionVisibility.subscribe((visibleSessions) => {
      notices.forEach((notice, key) => {
        if (!visibleSessions[key]) return;
        notice.dismiss();
        notices.delete(key);
      });
    });
    const dispose = observeAuthoringWork({
      client: queryClient,
      seedCachedSessions,
      refresh: (courseId, sessionId) =>
        refreshAuthoringSession(courseId, sessionId, isCurrentActor),
      isUnavailable: (error) =>
        isUnavailableAuthoringSession(error) ||
        (isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)),
      notify: (outcome, session) => {
        if (!isCurrentActor()) return;
        const noticeKey = authoringSessionVisibilityKey(session.courseId, session.sessionId);
        notices.get(noticeKey)?.dismiss();
        notices.delete(noticeKey);
        if (authoringSessionVisibility.getState()[noticeKey]) return;
        const notice = presentation.current.toast({
          description: presentation.current.t(`courseAuthoring.notifications.${outcome}`),
          variant: outcome === "failed" ? "destructive" : "default",
          duration: outcome === "completed" ? 15_000 : Number.POSITIVE_INFINITY,
        });
        notices.set(noticeKey, notice);
      },
    });
    return () => {
      active = false;
      dispose();
      unsubscribeVisibility();
      notices.forEach((notice) => notice.dismiss());
      notices.clear();
    };
  }, [actorId, isLoggedIn]);
};
