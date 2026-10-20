import { useNavigate } from "@remix-run/react";
import { isAxiosError } from "axios";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { authoringContextKey } from "~/api/queries/useCourseAuthoringContextQuery";
import { refreshAuthoringSession } from "~/api/queries/useCourseAuthoringSessionQuery";
import { queryClient } from "~/api/queryClient";
import { ToastAction } from "~/components/ui/toast";
import { useToast } from "~/components/ui/use-toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";
import { observeAuthoringWork } from "~/modules/CourseAuthoring/authoringNotifications";
import { isUnavailableAuthoringSession } from "~/modules/CourseAuthoring/authoringSessionRecovery";

import type { CourseContext } from "~/modules/CourseAuthoring/courseAuthoring.types";

/** Keeps observed requests visible after closing the drawer or selecting another session. */
export const useGlobalCourseAuthoringNotifications = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const actorId = useCurrentUserStore((state) => state.currentUser?.id);
  const lastActor = useRef(actorId);
  const presentation = useRef({ t, toast, navigate });
  presentation.current = { t, toast, navigate };

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
        const noticeKey = `${session.courseId}:${session.sessionId}`;
        notices.get(noticeKey)?.dismiss();
        const context = queryClient.getQueryData<CourseContext>(
          authoringContextKey(session.courseId, session.language),
        );
        const open = presentation.current.t("courseAuthoring.notifications.open");
        const notice = presentation.current.toast({
          title: context?.title,
          action: (
            <ToastAction
              altText={open}
              onClick={() =>
                isCurrentActor() &&
                presentation.current.navigate(
                  `/admin/beta-courses/${encodeURIComponent(session.courseId)}/authoring?sessionId=${encodeURIComponent(session.sessionId)}`,
                )
              }
            >
              {open}
            </ToastAction>
          ),
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
      notices.forEach((notice) => notice.dismiss());
      notices.clear();
    };
  }, [actorId, isLoggedIn]);
};
