import { useEffect, useRef } from "react";

import { queryClient } from "~/api/queryClient";
import { getSocket } from "~/api/socket";

import type { Socket } from "socket.io-client";

interface CourseUpdatePayload {
  courseId: string;
  chapterId?: string;
  type: "lesson_removed" | "lesson_added" | "chapter_updated";
}

/**
 * Hook that listens for course update events via WebSocket
 * and automatically invalidates the course query to refetch data.
 */
export function useCourseUpdateListener(courseId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!courseId || typeof window === "undefined") return;

    const socket = getSocket();
    socketRef.current = socket;

    const handleCourseUpdated = (payload: CourseUpdatePayload) => {
      // Only invalidate if this is the course we're viewing
      if (payload.courseId === courseId) {
        console.debug("[CourseUpdateListener] Course updated, invalidating queries", payload);

        // Invalidate all course queries for this course (regardless of language)
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === "course" &&
              typeof key[1] === "object" &&
              key[1] !== null &&
              "id" in key[1] &&
              (key[1] as { id: string }).id === courseId
            );
          },
        });
      }
    };

    const joinCourseRoom = () => {
      if (!hasJoinedRef.current) {
        // Send a message to join the course room - this triggers authentication
        // and joins the user to their user-specific room via the WsJwtGuard
        socket.emit("join:course", { courseId });
        hasJoinedRef.current = true;
        console.debug("[CourseUpdateListener] Joined course room:", courseId);
      }
    };

    const handleConnect = () => {
      console.debug("[CourseUpdateListener] Connected to WebSocket");
      joinCourseRoom();
    };

    socket.on("course:updated", handleCourseUpdated);
    socket.on("connect", handleConnect);

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    } else {
      // Already connected, join the room
      joinCourseRoom();
    }

    return () => {
      socket.off("course:updated", handleCourseUpdated);
      socket.off("connect", handleConnect);
      if (hasJoinedRef.current) {
        socket.emit("leave:course", { courseId });
        hasJoinedRef.current = false;
      }
    };
  }, [courseId]);
}
