import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { io, type Socket } from "socket.io-client";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api/api-client";

const PENDING_UPLOADS_KEY = "mentingo_pending_video_uploads";

interface PendingUpload {
  uploadId: string;
  timestamp: number;
}

export function useGlobalVideoUploadPolling() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const isDev = import.meta.env.MODE === "development";
    const backendUrl = isDev ? "http://localhost:3000" : (ApiClient.instance.defaults.baseURL || window.location.origin);
    const socketUrl = backendUrl.replace(/^http/, "ws");

    socketRef.current = io(`${socketUrl}/video-upload`);

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Connected to video upload notifications WebSocket");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from video upload notifications");
    });

    socket.on("upload-status-change", (notification: {
      uploadId: string;
      status: "uploaded" | "processed" | "failed";
      fileKey?: string;
      fileUrl?: string;
      error?: string;
    }) => {
      console.log("WebSocket notification received:", notification);

      // Process all WebSocket notifications - they're already filtered by Redis pub/sub
      console.log("Processing WebSocket notification:", notification);

      if (notification.status === "processed") {
        // Video is ready!
        toast({
          description: t("uploadFile.toast.videoReady", {
            defaultValue: "Video is ready to use.",
          }),
        });

        // Clean up from pending uploads if exists
        removePendingUpload(notification.uploadId);
      } else if (notification.status === "failed") {
        // Upload failed
        toast({
          description: t("uploadFile.toast.videoFailed", {
            defaultValue: `Video upload failed: ${notification.error || "Unknown error"}`,
          }),
          variant: "destructive",
        });

        // Clean up from pending uploads if exists
        removePendingUpload(notification.uploadId);
      }
    });

    // Cleanup function
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [toast, t]);
}

// Function to add upload to global polling
export function addPendingUpload(uploadId: string) {
  try {
    const stored = localStorage.getItem(PENDING_UPLOADS_KEY);
    const pendingUploads: PendingUpload[] = stored ? JSON.parse(stored) : [];

    // Add if not already exists
    if (!pendingUploads.find(u => u.uploadId === uploadId)) {
      pendingUploads.push({
        uploadId,
        timestamp: Date.now(),
      });
      localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(pendingUploads));
    }
  } catch (error) {
    console.error("Error adding pending upload:", error);
  }
}

// Hook for listening to specific upload status changes
export function useUploadStatus(uploadId: string | null, onStatusChange?: (notification: {
  uploadId: string;
  status: "uploaded" | "processed" | "failed";
  fileKey?: string;
  fileUrl?: string;
  error?: string;
}) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!uploadId) return;

    const isDev = import.meta.env.MODE === "development";
    const backendUrl = isDev ? "http://localhost:3000" : (ApiClient.instance.defaults.baseURL || window.location.origin);
    const socketUrl = backendUrl.replace(/^http/, "ws");

    socketRef.current = io(`${socketUrl}/video-upload`);

    const socket = socketRef.current;

    socket.on("upload-status-change", (notification: {
      uploadId: string;
      status: "uploaded" | "processed" | "failed";
      fileKey?: string;
      fileUrl?: string;
      error?: string;
    }) => {
      if (notification.uploadId === uploadId && onStatusChange) {
        onStatusChange(notification);
      }
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [uploadId, onStatusChange]);

  return socketRef.current;
}

// Function to remove upload from global polling
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
