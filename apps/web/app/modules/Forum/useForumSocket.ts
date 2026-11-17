import { FORUM_SOCKET_EVENTS } from "@repo/shared";
import { useEffect } from "react";

import { FORUM_QUERY_KEY } from "~/api/queries/forum/forumQueryKeys";
import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";

const FORUM_CHANGED_DEBOUNCE_MS = 500;

type ForumSocketOptions = {
  /** An organization-wide topic to follow in addition to the forum itself. */
  topicId?: string;
  onMentioned?: () => void;
};

export function useForumSocket({ topicId, onMentioned }: ForumSocketOptions) {
  useEffect(() => {
    const socket = acquireSocket();
    let forumChangedTimeout: number | undefined;

    const joinRooms = () => {
      socket.emit(FORUM_SOCKET_EVENTS.JOIN);

      if (topicId) socket.emit(FORUM_SOCKET_EVENTS.JOIN_TOPIC, { topicId });
    };
    const leaveRooms = () => {
      socket.emit(FORUM_SOCKET_EVENTS.LEAVE);

      if (topicId) socket.emit(FORUM_SOCKET_EVENTS.LEAVE_TOPIC, { topicId });
    };
    const handleConnect = () => {
      joinRooms();
      queryClient.invalidateQueries({ queryKey: FORUM_QUERY_KEY });
    };
    const refreshForum = () => {
      queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "topics"] });
      queryClient.invalidateQueries({
        queryKey: [...FORUM_QUERY_KEY, "topic"],
        refetchType: "none",
      });
    };
    const handleForumChanged = () => {
      window.clearTimeout(forumChangedTimeout);
      forumChangedTimeout = window.setTimeout(refreshForum, FORUM_CHANGED_DEBOUNCE_MS);
    };
    const handleTopicChanged = (payload: { topicId: string }) => {
      if (payload.topicId !== topicId) return;

      queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "topic", topicId] });
    };
    const handleMentioned = () => onMentioned?.();

    socket.on("connect", handleConnect);
    socket.on(FORUM_SOCKET_EVENTS.CHANGED, handleForumChanged);
    socket.on(FORUM_SOCKET_EVENTS.TOPIC_CHANGED, handleTopicChanged);
    socket.on(FORUM_SOCKET_EVENTS.USER_MENTIONED, handleMentioned);
    socket.connect();

    if (socket.connected) joinRooms();

    return () => {
      window.clearTimeout(forumChangedTimeout);
      leaveRooms();
      socket.off("connect", handleConnect);
      socket.off(FORUM_SOCKET_EVENTS.CHANGED, handleForumChanged);
      socket.off(FORUM_SOCKET_EVENTS.TOPIC_CHANGED, handleTopicChanged);
      socket.off(FORUM_SOCKET_EVENTS.USER_MENTIONED, handleMentioned);
      releaseSocket();
    };
  }, [topicId, onMentioned]);
}
