import { VIDEO_UPLOAD_STATUS } from "@repo/shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { acquireSocket, releaseSocket } from "~/api/socket";
import { useToast } from "~/components/ui/use-toast";

import type { VideoUploadStatus } from "@repo/shared";

interface UploadNotification {
  uploadId: string;
  status: VideoUploadStatus;
  fileKey?: string;
  fileUrl?: string;
  error?: string;
}

export function useGlobalVideoUploadNotifications() {
  const { toast } = useToast();
  const { t } = useTranslation();
  useEffect(() => {
    const socket = acquireSocket();

    const handleConnect = () => {
      socket.emit("join:user");
    };

    socket.on("connect", handleConnect);
    socket.connect();

    if (socket.connected) {
      handleConnect();
    }

    const handleUploadStatusChange = (notification: UploadNotification) => {
      match(notification.status)
        .with(VIDEO_UPLOAD_STATUS.PROCESSED, () =>
          toast({
            description: t("uploadFile.toast.videoReady"),
          }),
        )
        .with(VIDEO_UPLOAD_STATUS.FAILED, () =>
          toast({
            description: t("uploadFile.toast.videoFailed"),
          }),
        );
    };
    socket.on("upload-status-change", handleUploadStatusChange);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("upload-status-change", handleUploadStatusChange);
      releaseSocket();
    };
  }, [toast, t]);
}
