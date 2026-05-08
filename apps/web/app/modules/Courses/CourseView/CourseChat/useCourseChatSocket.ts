import { COURSE_CHAT_SOCKET_EVENTS } from "@repo/shared";
import { useEffect } from "react";

import {
  invalidateCourseChatMessageCreated,
  updateDeletedMessageInCache,
  updateCourseChatUserPresence,
  updateMessageReactionsInCache,
} from "~/api/queries/course-chat/useCourseChat";
import { acquireSocket, releaseSocket } from "~/api/socket";

import type { DeleteMessageResponse, ToggleMessageReactionResponse } from "~/api/generated-api";
import type { CourseChatMessage } from "~/api/queries/course-chat/courseChatTypes";

type PresenceChangedPayload = {
  courseId: string;
  userId: string;
  isOnline: boolean;
};

type MentionedPayload = {
  courseId: string;
  message: CourseChatMessage;
};

const COURSE_CHAT_PRESENCE_REFRESH_INTERVAL_MS = 60 * 1000;

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
      if (message.courseId !== courseId) return;

      invalidateCourseChatMessageCreated({
        courseId: message.courseId,
        parentMessageId: message.parentMessageId,
      });
    };
    const handlePresenceChanged = (payload: PresenceChangedPayload) => {
      if (payload.courseId === courseId) updateCourseChatUserPresence(payload);
    };
    const handleMentioned = (payload: MentionedPayload) => {
      if (payload.courseId === courseId) onMentioned?.(payload);
    };
    const handleMessageReactionsUpdated = (payload: ToggleMessageReactionResponse["data"]) => {
      if (payload.courseId === courseId) updateMessageReactionsInCache(payload);
    };
    const handleMessageDeleted = (payload: DeleteMessageResponse["data"]) => {
      if (payload.courseId === courseId) updateDeletedMessageInCache(payload);
    };

    socket.on("connect", joinRoom);
    socket.on(COURSE_CHAT_SOCKET_EVENTS.MESSAGE_CREATED, handleMessageCreated);
    socket.on(COURSE_CHAT_SOCKET_EVENTS.USER_PRESENCE_CHANGED, handlePresenceChanged);
    socket.on(COURSE_CHAT_SOCKET_EVENTS.USER_MENTIONED, handleMentioned);
    socket.on(COURSE_CHAT_SOCKET_EVENTS.MESSAGE_REACTIONS_UPDATED, handleMessageReactionsUpdated);
    socket.on(COURSE_CHAT_SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
    socket.connect();

    if (socket.connected) joinRoom();
    const presenceRefreshInterval = window.setInterval(
      joinRoom,
      COURSE_CHAT_PRESENCE_REFRESH_INTERVAL_MS,
    );

    return () => {
      window.clearInterval(presenceRefreshInterval);
      leaveRoom();
      socket.off("connect", joinRoom);
      socket.off(COURSE_CHAT_SOCKET_EVENTS.MESSAGE_CREATED, handleMessageCreated);
      socket.off(COURSE_CHAT_SOCKET_EVENTS.USER_PRESENCE_CHANGED, handlePresenceChanged);
      socket.off(COURSE_CHAT_SOCKET_EVENTS.USER_MENTIONED, handleMentioned);
      socket.off(
        COURSE_CHAT_SOCKET_EVENTS.MESSAGE_REACTIONS_UPDATED,
        handleMessageReactionsUpdated,
      );
      socket.off(COURSE_CHAT_SOCKET_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      releaseSocket();
    };
  }, [courseId, enabled, onMentioned]);
}
