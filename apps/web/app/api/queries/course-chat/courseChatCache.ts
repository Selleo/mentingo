import { FORUM_QUERY_KEY } from "~/api/queries/forum/forumQueryKeys";
import { queryClient } from "~/api/queryClient";

import {
  COURSE_CHAT_MESSAGES_QUERY_KEY,
  getCourseChatMessagesQueryKey,
} from "./useCourseChatMessages";
import { COURSE_CHAT_REPLIES_QUERY_KEY } from "./useCourseChatReplies";
import { getCourseChatUsersQueryKey } from "./useCourseChatUsers";

import type {
  CourseChatMessage,
  CourseChatMessagePreview,
  CourseChatRepliesResponse,
  CourseChatUser,
} from "./courseChatTypes";
import type { InfiniteData } from "@tanstack/react-query";
import type {
  DeleteMessageResponse,
  GetMessagesResponse,
  ToggleMessageReactionResponse,
} from "~/api/generated-api";

export function cacheCourseChatMessagesPage(courseId: string, messages: GetMessagesResponse) {
  const { page, perPage } = messages.pagination;

  queryClient.setQueryData(getCourseChatMessagesQueryKey(courseId, page, perPage), messages);
}

export function invalidateCourseChatMessages(courseId: string) {
  queryClient.invalidateQueries({
    queryKey: [...COURSE_CHAT_MESSAGES_QUERY_KEY, courseId],
  });
}

export function invalidateCourseChatReplies(messageId: string) {
  queryClient.invalidateQueries({
    queryKey: [...COURSE_CHAT_REPLIES_QUERY_KEY, messageId],
  });
}

export function invalidateCourseChatMessageCreated(params: {
  courseId: string;
  parentMessageId?: string | null;
}) {
  invalidateCourseChatMessages(params.courseId);

  if (params.parentMessageId) {
    invalidateCourseChatReplies(params.parentMessageId);
  }

  invalidateForumCourseDiscussions();
}

function invalidateForumCourseDiscussions() {
  queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "course-discussions"] });
  queryClient.invalidateQueries({ queryKey: [...FORUM_QUERY_KEY, "course-discussion"] });
}

export function updateCourseChatUserPresence(params: {
  courseId: string;
  userId: string;
  isOnline: boolean;
}) {
  queryClient.setQueryData<CourseChatUser[]>(
    getCourseChatUsersQueryKey(params.courseId),
    (current) =>
      current?.map((user) =>
        user.id === params.userId ? { ...user, isOnline: params.isOnline } : user,
      ),
  );
}

export function updateMessageReactionsInCache(payload: ToggleMessageReactionResponse["data"]) {
  const updatePreview = <T extends CourseChatMessagePreview>(message: T): T =>
    message.id === payload.messageId ? { ...message, reactions: payload.reactions } : message;

  const updateMessage = (message: CourseChatMessage): CourseChatMessage => ({
    ...updatePreview(message),
    latestReply: message.latestReply ? updatePreview(message.latestReply) : null,
  });

  queryClient.setQueriesData<GetMessagesResponse>(
    { queryKey: [...COURSE_CHAT_MESSAGES_QUERY_KEY, payload.courseId] },
    (current) =>
      current
        ? {
            ...current,
            data: current.data.map(updateMessage),
          }
        : current,
  );

  invalidateRepliesHolding(payload.messageId);
}

export function invalidateMessageReactions(payload: { courseId: string; messageId: string }) {
  queryClient.invalidateQueries({
    queryKey: [...COURSE_CHAT_MESSAGES_QUERY_KEY, payload.courseId],
    predicate: (query) => hasCachedMessage(query.state.data, payload.messageId),
  });
  invalidateRepliesHolding(payload.messageId);
}

function invalidateRepliesHolding(messageId: string) {
  queryClient.invalidateQueries({
    queryKey: COURSE_CHAT_REPLIES_QUERY_KEY,
    predicate: (query) => hasCachedReply(query.state.data, messageId),
  });
}

function hasCachedMessage(cachedMessages: unknown, messageId: string) {
  const messages = cachedMessages as GetMessagesResponse | undefined;

  return Boolean(
    messages?.data.some(
      (message) => message.id === messageId || message.latestReply?.id === messageId,
    ),
  );
}

function hasCachedReply(cachedReplies: unknown, messageId: string) {
  const replies = cachedReplies as
    | CourseChatRepliesResponse
    | InfiniteData<CourseChatRepliesResponse>
    | undefined;

  if (!replies) return false;

  const pages = "pages" in replies ? replies.pages : [replies];

  return pages.some((page) => page.data.some((reply) => reply.id === messageId));
}

export function updateDeletedMessageInCache(payload: DeleteMessageResponse["data"]) {
  queryClient.invalidateQueries({
    queryKey: [...COURSE_CHAT_MESSAGES_QUERY_KEY, payload.courseId],
  });

  if (payload.parentMessageId) {
    queryClient.invalidateQueries({
      queryKey: [...COURSE_CHAT_REPLIES_QUERY_KEY, payload.parentMessageId],
    });
  }

  invalidateForumCourseDiscussions();
}
