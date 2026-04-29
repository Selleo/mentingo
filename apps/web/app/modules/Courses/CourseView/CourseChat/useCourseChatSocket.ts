import { useEffect } from "react";

import {
  type CourseChatMessage,
  type CreateCourseChatThreadResponse,
  updateCourseChatUserPresence,
  upsertMessageInCache,
  upsertThreadInCache,
} from "~/api/queries/course-chat/useCourseChat";
import { acquireSocket, releaseSocket } from "~/api/socket";

const COURSE_CHAT_SOCKET_EVENTS = {
  JOIN: "join:course-chat",
  LEAVE: "leave:course-chat",
  MESSAGE_CREATED: "course-chat:message-created",
  THREAD_CREATED: "course-chat:thread-created",
  USER_PRESENCE_CHANGED: "course-chat:user-presence-changed",
  USER_MENTIONED: "course-chat:user-mentioned",
} as const;

type PresenceChangedPayload = {
  courseId: string;
  userId: string;
  isOnline: boolean;
};

type MentionedPayload = {
  courseId: string;
  message: CourseChatMessage;
};

export function useCourseChatSocket({
  courseId,
  enabled,
  onMentioned,
}: {
  courseId: string;
  enabled: boolean;
  onMentioned?: (payload: MentionedPayload) => void;
}) {
  useEffect(() => {
    if (!enabled || !courseId) return;

    const socket = acquireSocket();
    const joinRoom = () => socket.emit(COURSE_CHAT_SOCKET_EVENTS.JOIN, { courseId });
    const leaveRoom = () => socket.emit(COURSE_CHAT_SOCKET_EVENTS.LEAVE, { courseId });
    const handleMessageCreated = (message: CourseChatMessage) => {
      if (message.courseId === courseId) upsertMessageInCache(message);
    };
    const handleThreadCreated = ({ thread }: CreateCourseChatThreadResponse) => {
      if (thread.courseId === courseId) upsertThreadInCache(thread);
    };
    const handlePresenceChanged = (payload: PresenceChangedPayload) => {
      if (payload.courseId === courseId) updateCourseChatUserPresence(payload);
    };
    const handleMentioned = (payload: MentionedPayload) => {
      if (payload.courseId === courseId) onMentioned?.(payload);
    };

    socket.on("connect", joinRoom);
    socket.on(COURSE_CHAT_SOCKET_EVENTS.MESSAGE_CREATED, handleMessageCreated);
    socket.on(COURSE_CHAT_SOCKET_EVENTS.THREAD_CREATED, handleThreadCreated);
    socket.on(COURSE_CHAT_SOCKET_EVENTS.USER_PRESENCE_CHANGED, handlePresenceChanged);
    socket.on(COURSE_CHAT_SOCKET_EVENTS.USER_MENTIONED, handleMentioned);
    socket.connect();

    if (socket.connected) joinRoom();

    return () => {
      leaveRoom();
      socket.off("connect", joinRoom);
      socket.off(COURSE_CHAT_SOCKET_EVENTS.MESSAGE_CREATED, handleMessageCreated);
      socket.off(COURSE_CHAT_SOCKET_EVENTS.THREAD_CREATED, handleThreadCreated);
      socket.off(COURSE_CHAT_SOCKET_EVENTS.USER_PRESENCE_CHANGED, handlePresenceChanged);
      socket.off(COURSE_CHAT_SOCKET_EVENTS.USER_MENTIONED, handleMentioned);
      releaseSocket();
    };
  }, [courseId, enabled, onMentioned]);
}
