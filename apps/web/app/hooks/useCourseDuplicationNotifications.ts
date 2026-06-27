import { useLocation, useNavigate } from "@remix-run/react";
import {
  COURSE_DUPLICATION_SOCKET,
  COURSE_DUPLICATION_STATUS,
  type CourseDuplicationStatus,
} from "@repo/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { COURSE_DUPLICATION_JOB_QUERY_KEY } from "~/api/queries/admin/useCourseDuplicationJobStatus";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";
import { useToast } from "~/components/ui/use-toast";

type CourseDuplicationNotification = {
  courseId: string;
  sourceCourseId: string;
  jobId: string;
  status: CourseDuplicationStatus;
  messageKey?: string;
};

const COURSE_DUPLICATION_PROCESSING_TOAST_DURATION = Number.POSITIVE_INFINITY;
const COURSE_DUPLICATION_FAILURE_TOAST_DURATION = Number.POSITIVE_INFINITY;

export function useCourseDuplicationNotifications() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const processingToastRef = useRef<ReturnType<typeof toast> | null>(null);
  const processingJobIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const socket = acquireSocket();

    const handleConnect = () => socket.emit("join:user");

    const invalidateCourseDuplicationQueries = (courseId: string, jobId: string) => {
      void queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["course"] });
      void queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id: courseId }] });
      void queryClient.invalidateQueries({
        queryKey: [COURSE_DUPLICATION_JOB_QUERY_KEY, { jobId }],
      });
    };

    const showProcessingToast = () => {
      if (processingToastRef.current) return;

      processingToastRef.current = toast({
        description: t(COURSE_DUPLICATION_SOCKET.MESSAGE_KEYS.PROCESSING),
        variant: "loading",
        duration: COURSE_DUPLICATION_PROCESSING_TOAST_DURATION,
      });
    };

    const dismissProcessingToastIfIdle = () => {
      if (processingJobIdsRef.current.size > 0) return;

      processingToastRef.current?.dismiss();
      processingToastRef.current = null;
    };

    const removeDuplicationJobParam = (courseId: string, jobId: string) => {
      const expectedPath = `/admin/beta-courses/${courseId}`;
      if (location.pathname !== expectedPath) return;

      const params = new URLSearchParams(location.search);
      if (params.get("duplicationJobId") !== jobId) return;

      params.delete("duplicationJobId");
      const nextSearch = params.toString();
      navigate(nextSearch ? `${expectedPath}?${nextSearch}` : expectedPath, { replace: true });
    };

    const handleStatusChange = (notification: CourseDuplicationNotification) => {
      invalidateCourseDuplicationQueries(notification.courseId, notification.jobId);

      if (notification.status === COURSE_DUPLICATION_STATUS.PROCESSING) {
        processingJobIdsRef.current.add(notification.jobId);
        showProcessingToast();
        return;
      }

      processingJobIdsRef.current.delete(notification.jobId);
      dismissProcessingToastIfIdle();

      if (notification.status === COURSE_DUPLICATION_STATUS.COMPLETED) {
        removeDuplicationJobParam(notification.courseId, notification.jobId);
        toast({
          description: t(
            notification.messageKey ?? COURSE_DUPLICATION_SOCKET.MESSAGE_KEYS.COMPLETED,
          ),
          variant: "success",
        });
        return;
      }

      toast({
        description: t(notification.messageKey ?? COURSE_DUPLICATION_SOCKET.MESSAGE_KEYS.FAILED),
        variant: "destructive",
        duration: COURSE_DUPLICATION_FAILURE_TOAST_DURATION,
      });
    };

    socket.on("connect", handleConnect);
    socket.on(COURSE_DUPLICATION_SOCKET.EVENTS.STATUS_CHANGED, handleStatusChange);
    socket.connect();

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(COURSE_DUPLICATION_SOCKET.EVENTS.STATUS_CHANGED, handleStatusChange);
      releaseSocket();
    };
  }, [location.pathname, location.search, navigate, t, toast]);
}
