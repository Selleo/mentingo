import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { io, type Socket } from "socket.io-client";

import { useToast } from "~/components/ui/use-toast";
import { baseUrl } from "~/utils/baseUrl";

type UploadStatus = "uploaded" | "processed" | "failed";

interface UploadNotification {
  uploadId: string;
  status: UploadStatus;
  fileKey?: string;
  fileUrl?: string;
  error?: string;
}

function createVideoUploadSocket() {
  const socketUrl = baseUrl.replace(/^http/, "ws");

  return io(socketUrl + "/ws", {
    path: "/api/ws",
    withCredentials: true,
    transports: ["websocket"],
  });
}

export function useGlobalVideoUploadNotifications() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = createVideoUploadSocket();
    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Connected to video upload notifications WebSocket");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from video upload notifications");
    });

    socket.on("upload-status-change", (notification: UploadNotification) => {
      console.log("WebSocket notification received:", notification);

      if (notification.status === "processed") {
        toast({
          description: t("uploadFile.toast.videoReady", {
            defaultValue: "Video is ready to use.",
          }),
        });
      } else if (notification.status === "failed") {
        toast({
          description: t("uploadFile.toast.videoFailed", {
            defaultValue: `Video upload failed: ${notification.error || "Unknown error"}`,
          }),
          variant: "destructive",
        });
      }
    });

    console.log(socketRef);

    return () => {
      socket.disconnect();
    };
  }, [toast, t]);
}
