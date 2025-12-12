import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { io, type Socket } from "socket.io-client";

import { useToast } from "~/components/ui/use-toast";

const PENDING_UPLOADS_KEY = "mentingo_pending_video_uploads";

interface PendingUpload {
  uploadId: string;
  timestamp: number;
}

type UploadStatus = "uploaded" | "processed" | "failed";

interface UploadNotification {
  uploadId: string;
  status: UploadStatus;
  fileKey?: string;
  fileUrl?: string;
  error?: string;
}

// Shared socket setup utility
function createVideoUploadSocket() {
  const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const socketUrl = backendUrl.replace(/^http/, "ws");

  return io(`${socketUrl}/video-upload`);
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
        removePendingUpload(notification.uploadId);
      } else if (notification.status === "failed") {
        toast({
          description: t("uploadFile.toast.videoFailed", {
            defaultValue: `Video upload failed: ${notification.error || "Unknown error"}`,
          }),
          variant: "destructive",
        });
        removePendingUpload(notification.uploadId);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [toast, t]);
}

// Hook for listening to specific upload status changes
export function useUploadStatus(
  uploadId: string | null,
  onStatusChange?: (notification: UploadNotification) => void
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!uploadId) return;

    socketRef.current = createVideoUploadSocket();
    const socket = socketRef.current;

    socket.on("upload-status-change", (notification: UploadNotification) => {
      if (notification.uploadId === uploadId && onStatusChange) {
        onStatusChange(notification);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [uploadId, onStatusChange]);

  return socketRef.current;
}

// Utility functions for managing pending uploads
export function addPendingUpload(uploadId: string) {
  try {
    const stored = localStorage.getItem(PENDING_UPLOADS_KEY);
    const pendingUploads: PendingUpload[] = stored ? JSON.parse(stored) : [];

    if (!pendingUploads.find(u => u.uploadId === uploadId)) {
      pendingUploads.push({ uploadId, timestamp: Date.now() });
      localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(pendingUploads));
    }
  } catch (error) {
    console.error("Error adding pending upload:", error);
  }
}

export function removePendingUpload(uploadId: string) {
  try {
    const stored = localStorage.getItem(PENDING_UPLOADS_KEY);
    if (!stored) return;

    const pendingUploads: PendingUpload[] = JSON.parse(stored);
    const filtered = pendingUploads.filter(u => u.uploadId !== uploadId);

    if (filtered.length === 0) {
      localStorage.removeItem(PENDING_UPLOADS_KEY);
    } else {
      localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error("Error removing pending upload:", error);
  }
}
