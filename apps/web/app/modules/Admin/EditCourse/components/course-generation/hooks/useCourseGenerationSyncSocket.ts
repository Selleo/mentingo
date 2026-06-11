import { COURSE_GENERATION_SYNC_SOCKET_EVENT, COURSE_GENERATION_SYNC_STATUS } from "@repo/shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { acquireSocket, releaseSocket } from "~/api/socket";
import { useToast } from "~/components/ui/use-toast";
import { invalidateCourseGenerationSyncQueries } from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationSync.utils";

import type { SyncGeneratedCourseResponse } from "~/api/generated-api";

type CourseGenerationSyncSocketPayload = SyncGeneratedCourseResponse & {
  courseId: string;
  messageKey?: string;
  error?: string;
  userId?: string;
};

type UseCourseGenerationSyncSocketOptions = {
  courseId: string;
  enabled: boolean;
  onProcessed?: () => void;
  onFailed?: (payload: CourseGenerationSyncSocketPayload) => void;
};

export function useCourseGenerationSyncSocket({
  courseId,
  enabled,
  onProcessed,
  onFailed,
}: UseCourseGenerationSyncSocketOptions) {
  const { t } = useTranslation();
  const { toast } = useToast();

  useEffect(() => {
    if (!enabled || !courseId) return;

    const socket = acquireSocket();
    const handleConnect = () => socket.emit("join:user");

    const handleStatusChanged = (payload: CourseGenerationSyncSocketPayload) => {
      if (payload.courseId !== courseId) return;

      const invalidate = invalidateCourseGenerationSyncQueries(courseId);

      if (payload.status === COURSE_GENERATION_SYNC_STATUS.PROCESSED) {
        void invalidate.then(() => {
          if (payload.messageKey) {
            toast({ description: t(payload.messageKey) });
          }

          onProcessed?.();
        });
        return;
      }

      if (payload.status === COURSE_GENERATION_SYNC_STATUS.FAILED) {
        void invalidate.then(() => onFailed?.(payload));
      }
    };

    socket.on("connect", handleConnect);
    socket.on(COURSE_GENERATION_SYNC_SOCKET_EVENT, handleStatusChanged);
    socket.connect();

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(COURSE_GENERATION_SYNC_SOCKET_EVENT, handleStatusChanged);
      releaseSocket();
    };
  }, [courseId, enabled, onFailed, onProcessed, t, toast]);
}
