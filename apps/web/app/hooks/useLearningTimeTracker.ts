import { useCallback, useEffect, useRef } from "react";

import { getSocket } from "~/api/socket";

import type { Socket } from "socket.io-client";

interface UseLearningTimeTrackerOptions {
  lessonId: string;
  courseId: string;
  enabled?: boolean;
}

const HEARTBEAT_INTERVAL = 10_000; // 10 seconds
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useLearningTimeTracker({
  lessonId,
  courseId,
  enabled = true,
}: UseLearningTimeTrackerOptions) {
  const socketRef = useRef<Socket | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(true);
  const isConnectedRef = useRef(false);

  const resetIdleTimer = useCallback(() => {
    isActiveRef.current = true;

    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = setTimeout(() => {
      isActiveRef.current = false;
    }, IDLE_TIMEOUT);
  }, []);

  const isTabVisible = useCallback(() => {
    return typeof document !== "undefined" && document.visibilityState === "visible";
  }, []);

  const sendHeartbeat = useCallback(() => {
    if (!socketRef.current?.connected || !isTabVisible()) return;

    socketRef.current.emit("heartbeat", {
      lessonId,
      courseId,
      timestamp: Date.now(),
      isActive: isActiveRef.current,
    });
  }, [lessonId, courseId, isTabVisible]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const socket = getSocket();
    socketRef.current = socket;

    const startTracking = () => {
      socket.emit("join:lesson", { lessonId, courseId });

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    };

    const handleConnect = () => {
      isConnectedRef.current = true;
      console.debug("[LearningTimeTracker] Connected to WebSocket");
      startTracking();
    };

    const handleDisconnect = () => {
      isConnectedRef.current = false;
      console.debug("[LearningTimeTracker] Disconnected from WebSocket");

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    const handleConnectError = (error: Error) => {
      console.error("[LearningTimeTracker] Connection error:", error.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) {
      startTracking();
    } else {
      socket.connect();
    }

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((event) => {
      document.addEventListener(event, resetIdleTimer, { passive: true });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetIdleTimer();

        if (socket && !socket.connected) {
          socket.connect();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const handleBeforeUnload = () => {
      if (socket?.connected) {
        socket.emit("leave:lesson", { lessonId });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    resetIdleTimer();

    return () => {
      if (socket?.connected) {
        socket.emit("leave:lesson", { lessonId });
      }

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      activityEvents.forEach((event) => {
        document.removeEventListener(event, resetIdleTimer);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      socketRef.current = null;
    };
  }, [enabled, lessonId, courseId, sendHeartbeat, resetIdleTimer]);

  return {
    isConnected: isConnectedRef.current,
  };
}
