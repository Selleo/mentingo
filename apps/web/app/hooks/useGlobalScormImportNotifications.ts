import { useLocation, useNavigate } from "@remix-run/react";
import { SCORM_IMPORT_ACTION, SCORM_IMPORT_SOCKET, SCORM_PACKAGE_STATUS } from "@repo/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";
import { useToast } from "~/components/ui/use-toast";

import type { ScormImportAction, ScormPackageStatus, SupportedLanguages } from "@repo/shared";

type ScormImportNotification = {
  action: ScormImportAction;
  status: ScormPackageStatus;
  courseId?: string;
  lessonId?: string;
  packageId: string;
  language: SupportedLanguages;
  messageKey?: string;
};

const SCORM_IMPORT_PROCESSING_TOAST_DURATION = Number.POSITIVE_INFINITY;
const SCORM_IMPORT_FAILURE_TOAST_DURATION = Number.POSITIVE_INFINITY;

export function useGlobalScormImportNotifications() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const navigate = useNavigate();
  const location = useLocation();

  const processingToastRef = useRef<ReturnType<typeof toast> | null>(null);
  const processingPackageIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const socket = acquireSocket();

    const handleConnect = () => socket.emit("join:user");

    const invalidateScormImportQueries = () => {
      void queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["course"] });
    };

    const showProcessingToast = () => {
      if (processingToastRef.current) return;

      processingToastRef.current = toast({
        description: t(SCORM_IMPORT_SOCKET.MESSAGE_KEYS.PROCESSING),
        variant: "loading",
        duration: SCORM_IMPORT_PROCESSING_TOAST_DURATION,
      });
    };

    const dismissProcessingToastIfIdle = () => {
      if (processingPackageIdsRef.current.size > 0) return;

      processingToastRef.current?.dismiss();
      processingToastRef.current = null;
    };

    const handleImportStatusChange = (notification: ScormImportNotification) => {
      invalidateScormImportQueries();

      if (notification.status === SCORM_PACKAGE_STATUS.PROCESSING) {
        processingPackageIdsRef.current.add(notification.packageId);
        showProcessingToast();
        return;
      }

      processingPackageIdsRef.current.delete(notification.packageId);
      dismissProcessingToastIfIdle();

      if (notification.status === SCORM_PACKAGE_STATUS.READY) {
        toast({
          description: t(notification.messageKey ?? SCORM_IMPORT_SOCKET.MESSAGE_KEYS.READY),
          variant: "success",
        });

        return;
      }

      toast({
        description: t(notification.messageKey ?? SCORM_IMPORT_SOCKET.MESSAGE_KEYS.FAILED_LESSON),
        variant: "destructive",
        duration: SCORM_IMPORT_FAILURE_TOAST_DURATION,
      });

      const failedCourseEditPath =
        notification.action === SCORM_IMPORT_ACTION.CREATE_COURSE && notification.courseId
          ? `/admin/beta-courses/${notification.courseId}`
          : null;

      if (failedCourseEditPath && location.pathname === failedCourseEditPath) {
        navigate("/admin/courses");
      }
    };

    socket.on("connect", handleConnect);
    socket.on(SCORM_IMPORT_SOCKET.EVENTS.STATUS_CHANGED, handleImportStatusChange);
    socket.connect();

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(SCORM_IMPORT_SOCKET.EVENTS.STATUS_CHANGED, handleImportStatusChange);
      releaseSocket();
    };
  }, [location.pathname, navigate, t, toast]);
}
