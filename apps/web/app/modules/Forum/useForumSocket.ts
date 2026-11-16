import { FORUM_SOCKET_EVENTS } from "@repo/shared";
import { useEffect } from "react";

import { FORUM_QUERY_KEY } from "~/api/queries/forum/forumQueryKeys";
import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";

type ForumSocketOptions = {
  /** Without a topic the hook follows the topic list. */
  topicId?: string;
  enabled?: boolean;
  onMentioned?: () => void;
};

export function useForumSocket({ topicId, enabled = true, onMentioned }: ForumSocketOptions) {
  useEffect(() => {
    if (!enabled) return;

    const socket = acquireSocket();
    const joinRoom = () =>
      topicId
        ? socket.emit(FORUM_SOCKET_EVENTS.JOIN_TOPIC, { topicId })
        : socket.emit(FORUM_SOCKET_EVENTS.JOIN);
    const leaveRoom = () =>
      topicId
        ? socket.emit(FORUM_SOCKET_EVENTS.LEAVE_TOPIC, { topicId })
        : socket.emit(FORUM_SOCKET_EVENTS.LEAVE);
    const handleForumChanged = () => {
      queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "topics"] });
    };
    const handleTopicChanged = (payload: { topicId: string }) => {
      if (payload.topicId !== topicId) return;

      queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "topic", topicId] });
    };
    const handleMentioned = () => onMentioned?.();

    socket.on("connect", joinRoom);
    socket.on(FORUM_SOCKET_EVENTS.CHANGED, handleForumChanged);
    socket.on(FORUM_SOCKET_EVENTS.TOPIC_CHANGED, handleTopicChanged);
    socket.on(FORUM_SOCKET_EVENTS.USER_MENTIONED, handleMentioned);
    socket.connect();

    if (socket.connected) joinRoom();

    return () => {
      leaveRoom();
      socket.off("connect", joinRoom);
      socket.off(FORUM_SOCKET_EVENTS.CHANGED, handleForumChanged);
      socket.off(FORUM_SOCKET_EVENTS.TOPIC_CHANGED, handleTopicChanged);
      socket.off(FORUM_SOCKET_EVENTS.USER_MENTIONED, handleMentioned);
      releaseSocket();
    };
  }, [topicId, enabled, onMentioned]);
}
